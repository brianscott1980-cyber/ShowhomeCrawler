#!/usr/bin/env python3
"""Sequential, resumable collection/classification/publication of registered builders."""
import argparse, datetime, json, os, shutil, subprocess, sys, time
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'results/.cache'
STATE = CACHE / 'builder-recrawl-queue-state.json'
CONTROL = CACHE / 'recrawl-control.json'
MANIFEST = CACHE / 'remaining-builder-scan-state.json'
LOGS = CACHE / 'recrawl-logs'

def read_json(path, default=None):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return default

def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.queue.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n')
    temporary.replace(path)

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def remaining_order(order, after):
    if after not in order:
        raise ValueError('Starting builder is not in the recrawl order')
    return order[order.index(after) + 1:]

def validate_collection(report):
    if report.get('status') not in ('completed', 'completed_with_gaps') or not report.get('images'):
        raise ValueError('Collection is incomplete or empty')
    if any(report.get('metrics', {}).get(key, 0) for key in ('propertyLimitOmissions', 'imageLimitOmissions', 'developmentLimitOmissions')):
        raise ValueError('Collection has limit omissions')

def compare_reports(previous, current):
    old_urls = {p['url'] for p in (previous or {}).get('properties', [])}
    new_urls = {p['url'] for p in current.get('properties', [])}
    old_images = {i['id'] for i in (previous or {}).get('images', [])}
    new_images = {i['id'] for i in current.get('images', [])}
    return {'newPropertyUrls': sorted(new_urls - old_urls), 'missingPreviousPropertyUrls': sorted(old_urls - new_urls),
            'newImageIds': len(new_images - old_images), 'missingPreviousImageIds': len(old_images - new_images),
            'developments': len(current.get('developments', [])), 'galleries': len(current.get('properties', [])),
            'images': len(new_images), 'sourceErrors': [e for e in current.get('errors', []) if e.get('stage') != 'classification']}

class Queue:
    def __init__(self, args):
        self.args = args
        self.work = Path(args.worktree).resolve()
        self.branch = 'codex/sequential-builder-recrowls'
        self.state = read_json(STATE, {})
        self.run_id = self.state.get('runId', args.run_id)
        self.state.update({'runId': self.run_id, 'supervisorPid': os.getpid()})
        self.manifest = read_json(MANIFEST, {})
        self.env = dict(os.environ, GEMINI_MODEL='gemini-3.1-flash-lite')
        LOGS.mkdir(parents=True, exist_ok=True)

    def update(self, stage, **fields):
        self.state.update({'stage': stage, 'updatedAt': now(), **fields})
        save_json(STATE, self.state)

    def run(self, args, builder, stage):
        log = LOGS / f'{builder}-{stage}.log'
        with log.open('a') as output:
            proc = subprocess.Popen(args, cwd=self.work, env=self.env, stdout=output, stderr=subprocess.STDOUT)
            self.update(stage, activeBuilder=builder, childPid=proc.pid, log=str(log.relative_to(ROOT)))
            if proc.wait():
                raise RuntimeError(f'{builder}: {stage} failed; see {log}')

    def setup(self):
        if not self.work.exists():
            exists = subprocess.run(['git','show-ref','--verify','--quiet','refs/heads/'+self.branch],cwd=ROOT).returncode == 0
            command = ['git','worktree','add','--force',str(self.work),self.branch] if exists else ['git','worktree','add','-b',self.branch,str(self.work),'main']
            subprocess.run(command,cwd=ROOT,check=True)
        if not (self.work / 'node_modules').exists():
            if sys.platform == 'darwin':
                subprocess.run(['cp', '-cR', str(ROOT / 'node_modules'), str(self.work / 'node_modules')], check=True)
            else:
                shutil.copytree(ROOT / 'node_modules', self.work / 'node_modules')
        for name in ('results', '.env.local'):
            target = self.work / name
            if not target.exists():
                target.symlink_to(ROOT / name, target_is_directory=name == 'results')

    def wait_for_current(self):
        if self.state.get('currentBuilderFinished'):
            return
        self.update('waiting_for_current', activeBuilder=self.args.after)
        while True:
            current = read_json(ROOT / self.args.wait_state, {})
            if current.get('stage') in ('complete_paused', 'complete'):
                self.state['currentBuilderFinished'] = True
                self.manifest = read_json(MANIFEST, {})
                if self.args.after in self.manifest:
                    self.manifest[self.args.after].update({'status': 'published', 'publishedAt': now()})
                    save_json(MANIFEST, self.manifest)
                self.update('current_builder_complete')
                return
            if current.get('stage') == 'needs_attention':
                raise RuntimeError('Current builder needs attention: ' + current.get('error', 'unknown error'))
            pid = current.get('supervisorPid')
            if pid:
                try:
                    os.kill(pid, 0)
                except ProcessLookupError:
                    raise RuntimeError('Current builder worker stopped before publication')
            time.sleep(10)

    def collect(self, builder, candidate, index):
        existing = read_json(candidate / 'results.json')
        if existing and self.manifest.get(builder, {}).get('status') in ('collected', 'categorising') and (index < self.args.review_index or candidate.name.endswith('-home-offices')):
            validate_collection(existing)
            return existing
        checkpoint = read_json(candidate / 'checkpoint.json')
        resume = bool(checkpoint and checkpoint.get('builder', {}).get('slug') == builder and
                      checkpoint.get('analysisVersion') == 'all-property-images-v1' and checkpoint.get('status') in ('running', 'cancelled', 'failed'))
        self.manifest[builder] = {'status': 'scanning', 'startedAt': now(), 'folder': str(candidate.relative_to(ROOT))}
        save_json(MANIFEST, self.manifest)
        command = ['npx', 'tsx', 'src/cli/crawl.ts', '--builder', builder, '--all-images', '--discover-only',
                   '--output', str(candidate.relative_to(ROOT)), '--min-bedrooms', '1', '--max-developments', '1000',
                   '--max-properties', '10000', '--max-images', '100000']
        command += ['--resume'] if resume else ['--refresh-pages']
        self.run(command, builder, 'collecting')
        report = read_json(candidate / 'results.json', {})
        validate_collection(report)
        self.manifest[builder].update({'status': 'collected', 'developments': len(report['developments']),
                                      'galleries': len(report['properties']), 'images': len(report['images']),
                                      'sourceErrors': len(report.get('errors', [])), 'completedAt': now()})
        save_json(MANIFEST, self.manifest)
        return report

    def publish(self, builder, candidate, baseline, index):
        self.manifest[builder]['status'] = 'categorising'
        save_json(MANIFEST, self.manifest)
        self.run(['npx', 'tsx', 'src/cli/classify-stream.ts', '--folder', str(candidate.relative_to(ROOT)),
                  '--all-images', '--model', 'gemini-3.1-flash-lite'], builder, 'categorising')
        canonical = ROOT / 'results' / f'{builder}-home-offices'
        if candidate != canonical:
            if canonical.exists():
                canonical.rename(ROOT / 'results' / f'{builder}-home-offices-backup-{time.time_ns()}')
            candidate.rename(canonical)
        self.manifest[builder]['folder'] = str(canonical.relative_to(ROOT))
        save_json(MANIFEST, self.manifest)
        self.run(['npx', 'tsx', 'src/cli/classify-results.ts', '--folder', str(canonical.relative_to(ROOT)),
                  '--all-images', '--model', 'gemini-3.1-flash-lite'], builder, 'merging_analysis')
        self.run(['npx', 'tsx', 'src/cli/finalize-builder.ts', '--builder', builder], builder, 'finalising')
        report = read_json(canonical / 'results.json', {})
        audit_path = self.work / 'docs/builder-recrawl-audit.json'
        audit = read_json(audit_path, {})
        history = audit.get(builder, [])
        if not isinstance(history, list):
            history = [history]
        history.append({'runId': self.run_id, 'completedAt': now(), 'finalReview': index >= self.args.review_index,
                        **compare_reports(baseline, report)})
        audit[builder] = history
        save_json(audit_path, audit)
        subprocess.run(['git', 'merge', '--ff-only', 'main'], cwd=self.work, check=True)
        self.run(['npm', 'run', 'typecheck'], builder, 'typecheck')
        self.run(['npm', 'run', 'build'], builder, 'build')
        self.run(['git', 'diff', '--check'], builder, 'diff_check')
        folder = self.work / 'collections' / f'{builder}-home-offices'
        files = [str(p.relative_to(self.work)) for p in folder.iterdir() if p.is_file() and p.suffix in ('.json', '.html', '.csv')]
        self.run(['git', 'add', '--', *files, 'docs/builder-recrawl-audit.json'], builder, 'staging')
        self.run(['git', 'commit', '-m', f'Refresh {builder} galleries and genuine image categorisation'], builder, 'committing')
        subprocess.run(['git', 'rebase', 'main'], cwd=self.work, check=True)
        subprocess.run(['git', 'merge', '--ff-only', self.branch], cwd=ROOT, check=True)
        subprocess.run(['git', 'push', 'origin', 'main'], cwd=ROOT, check=True)
        shutil.copytree(folder / 'images', ROOT / 'collections' / f'{builder}-home-offices' / 'images', dirs_exist_ok=True)
        self.manifest[builder].update({'status': 'published', 'publishedAt': now(), 'commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=self.work, text=True).strip()})
        save_json(MANIFEST, self.manifest)
        with Path('/tmp/showhome-recrawl-sequence.log').open('a') as log:
            log.write(f'{builder} published and pushed at {now()}\n')
        self.update('published', activeBuilder=builder, nextIndex=index + 1)

    def execute(self):
        self.wait_for_current()
        self.setup()
        order = (ROOT / self.args.order_file).read_text().splitlines()
        builders = remaining_order(order, self.args.after)
        self.args.review_index = len(builders) - 3
        self.state['builders'] = builders
        failures = self.state.setdefault('sourceFailures', [])
        for index in range(self.state.get('nextIndex', 0), len(builders)):
            builder = builders[index]
            control = read_json(CONTROL, {})
            if control.get('pauseAfterCurrentBuilder'):
                self.update('paused', nextIndex=index)
                return
            subprocess.run(['git', 'merge', '--ff-only', 'main'], cwd=self.work, check=True)
            control.update({'activeBuilder': builder, 'pauseAfterCurrentBuilder': False})
            save_json(CONTROL, control)
            baseline = read_json(self.work / 'collections' / f'{builder}-home-offices/results.json')
            candidate = ROOT / 'results' / f'{builder}-unrestricted-scan-{self.run_id}'
            canonical = ROOT / 'results' / f'{builder}-home-offices'
            if self.manifest.get(builder, {}).get('folder') == str(canonical.relative_to(ROOT)) and self.manifest.get(builder, {}).get('status') in ('collected', 'categorising'):
                candidate = canonical
            self.update('collecting', activeBuilder=builder, nextIndex=index)
            try:
                self.collect(builder, candidate, index)
            except Exception as error:
                failures.append({'builder': builder, 'stage': 'collection', 'message': str(error), 'at': now()})
                self.manifest[builder] = {**self.manifest.get(builder, {}), 'status': 'needs_review', 'error': str(error)}
                save_json(MANIFEST, self.manifest)
                self.update('source_needs_review', nextIndex=index + 1)
                continue
            self.publish(builder, candidate, baseline, index)
            if read_json(CONTROL, {}).get('pauseAfterCurrentBuilder'):
                self.update('paused', nextIndex=index + 1)
                return
        control = read_json(CONTROL, {})
        control.pop('activeBuilder', None)
        save_json(CONTROL, control)
        self.update('finished_with_source_gaps' if failures else 'finished', activeBuilder=None)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--after', default='barratt')
    parser.add_argument('--order-file', default='docs/builder-recrawl-order.txt')
    parser.add_argument('--wait-state', default='results/.cache/barratt-completion-state.json')
    parser.add_argument('--worktree', default='/tmp/showhome-sequential-recrowls')
    parser.add_argument('--run-id', default='20261003')
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    lock = CACHE / 'builder-recrawl-queue.lock'
    if lock.exists():
        pid = read_json(lock, {}).get('pid')
        if pid:
            try:
                os.kill(pid, 0)
            except ProcessLookupError:
                lock.rename(lock.with_name(lock.name + f'.stale-{time.time_ns()}'))
            else:
                raise RuntimeError('A builder queue is already running')
    with lock.open('x') as output:
        json.dump({'pid': os.getpid()}, output)
    queue = Queue(args)
    try:
        queue.execute()
    except Exception as error:
        queue.update('needs_attention', error=str(error))
        raise
    finally:
        lock.unlink(missing_ok=True)

if __name__ == '__main__':
    main()
