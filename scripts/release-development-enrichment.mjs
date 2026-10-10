import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, '.showhome/enrichment');
const statePath = path.join(directory, 'release-status.json');
const scriptPath = 'scripts/release-development-enrichment.mjs';
const read = async p => JSON.parse(await fs.readFile(p, 'utf8'));
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const state = async value => fs.writeFile(statePath, JSON.stringify({ ...value, updatedAt: new Date().toISOString() }, null, 2));

async function completedAudit() {
  const progress = await read(path.join(directory, 'progress.json'));
  if (progress.status !== 'completed' || progress.failed !== 0) return null;
  try { await fs.access(path.join(directory, 'worker.lock')); return null; } catch {}
  const inventory = await read(path.join(directory, 'inventory.json'));
  const runs = [];
  for (const name of await fs.readdir(path.join(directory, 'runs'))) {
    if (name.endsWith('.json')) runs.push(await read(path.join(directory, 'runs', name)));
  }
  runs.push(progress);
  runs.sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));
  const records = new Map();
  for (const run of runs) for (const record of run.developments ?? []) records.set(record.key, record);
  const keys = inventory.developments.map(d => d.key);
  if (!keys.length || keys.some(key => !records.has(key) || records.get(key).status === 'failed')) return null;
  return { inventory, records: keys.map(key => records.get(key)), progress };
}

async function release(audit) {
  const counts = {};
  for (const record of audit.records) counts[record.status] = (counts[record.status] ?? 0) + 1;
  const reportPath = 'docs/reports/development-enrichment-completion.md';
  const report = `# Development enrichment completion\n\nCompleted: ${new Date().toISOString()}\n\n` +
    `Scanned ${audit.inventory.builders.length} builders, ${audit.records.length} developments and ${audit.progress.inventory.buildingTypes} building types.\n\n` +
    `| Development outcome | Count |\n| --- | ---: |\n${Object.entries(counts).map(([status, count]) => `| ${status} | ${count} |`).join('\n')}\n\n` +
    `The scan has finished with no outstanding failed requests. Missing locations and unavailable sources remain explicitly recorded; they are not presented as verified area summaries.\n\n` +
    `Builder ratings retain their sources and dates. Development contacts and grounded local-area summaries are saved in Supabase. Distances are approximate straight-line distances to mapped facility centres. Existing contact edits are preserved.\n\n` +
    `Detailed local audits: .showhome/enrichment/progress.json and .showhome/enrichment/runs/. Image files and private research caches are excluded from this release.\n`;
  git(root, 'fetch', 'origin');
  const worktree = path.join(directory, `release-worktree-${process.pid}-${Date.now()}`);
  git(root, 'worktree', 'add', '--detach', worktree, 'origin/main');
  try {
    // Merge both public branches before publishing; conflicts stop this attempt.
    git(worktree, 'merge', '--no-edit', 'origin/release/1.0.0');
    await fs.mkdir(path.join(worktree, 'docs/reports'), { recursive: true });
    await fs.writeFile(path.join(worktree, reportPath), report);
    await fs.copyFile(path.join(root, scriptPath), path.join(worktree, scriptPath));
    git(worktree, 'add', '--', reportPath, scriptPath);
    git(worktree, 'commit', '-m', 'Complete development enrichment scan and publish research summary');
    const commit = git(worktree, 'rev-parse', 'HEAD');
    // Atomic push prevents a race from updating only one branch. Never force.
    git(worktree, 'push', '--atomic', 'origin', 'HEAD:main', 'HEAD:release/1.0.0');
    await state({ status: 'released', commit, outcomes: counts, developments: audit.records.length });
    console.log(`Released ${commit} to main and release/1.0.0`);
  } finally {
    // Remove only the disposable Git worktree registered above.
    git(root, 'worktree', 'remove', '--force', worktree);
  }
}

if (process.argv.includes('--check')) {
  console.log(JSON.stringify({ ready: Boolean(await completedAudit()) }));
} else {
  let prior;
  try { prior = await read(statePath); } catch {}
  if (prior?.status !== 'released') {
    await state({ status: 'waiting_for_scan' });
    while (true) {
      try {
        const audit = await completedAudit();
        if (audit) { await release(audit); break; }
      } catch (error) {
        const message = error.stderr?.toString() || error.message;
        console.error(message);
        await state({ status: 'waiting_or_retrying', error: message });
      }
      await sleep(60_000);
    }
  }
}
