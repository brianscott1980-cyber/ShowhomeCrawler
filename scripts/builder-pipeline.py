#!/usr/bin/env python3
"""Three dependent stages, independently scheduled across builders; serialized publication."""
import argparse, datetime, json, os, shutil, subprocess, time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from importlib.util import spec_from_file_location, module_from_spec
ROOT=Path(__file__).resolve().parents[1]
spec=spec_from_file_location('recrawl',ROOT/'scripts/recrawl-builders.py');legacy=module_from_spec(spec);spec.loader.exec_module(legacy)
CACHE=ROOT/'results/.cache';STATE=CACHE/'builder-pipeline-state.json';LOGS=CACHE/'recrawl-logs'
STAGES=('gallery','website','ai')
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def eligible(stage,order,builders,active):
 index=STAGES.index(stage)
 for slug in order:
  state=builders.get(slug,{})
  if slug in active or state.get(stage,{}).get('status') in ('complete','failed'):continue
  if index and state.get(STAGES[index-1],{}).get('status')!='complete':continue
  return slug
 return None
class Pipeline:
 def __init__(self,args):
  self.args=args;self.work=Path(args.worktree).resolve();self.publish_lock=Lock();self.state_lock=Lock()
  self.state=legacy.read_json(STATE,{'runId':args.run_id,'builders':{},'streams':{}})
  self.state.update(supervisorPid=os.getpid(),updatedAt=now(),status='running')
  order=(ROOT/'docs/builder-recrawl-order.txt').read_text().splitlines()
  self.order=legacy.remaining_order(order,'barratt');self.state['order']=self.order
  self.env=dict(os.environ,GEMINI_MODEL='gemini-3.1-flash-lite');LOGS.mkdir(parents=True,exist_ok=True)
 def save(self):
  with self.state_lock:self.state['updatedAt']=now();legacy.save_json(STATE,self.state)
 def folder(self,slug):
  recorded=self.state['builders'].get(slug,{}).get('folder')
  if recorded:return ROOT/recorded
  candidate=ROOT/'results'/f'{slug}-unrestricted-scan-{self.args.run_id}'
  manifest=legacy.read_json(legacy.MANIFEST,{})
  if not candidate.exists() and manifest.get(slug,{}).get('folder'):candidate=ROOT/manifest[slug]['folder']
  return candidate
 def run(self,slug,stage,command,cwd=ROOT):
  log=LOGS/f'{slug}-pipeline-{stage}.log'
  with log.open('a') as output:
   proc=subprocess.Popen(command,cwd=cwd,env=self.env,stdout=output,stderr=subprocess.STDOUT)
   with self.state_lock:self.state['streams'][stage]={'builder':slug,'pid':proc.pid,'status':'running','log':str(log.relative_to(ROOT))}
   self.save()
   if proc.wait():raise RuntimeError(f'{stage} failed; see {log}')
 def checkpoint(self,slug,stage,folder,report):
  """Commit completed intermediate data separately from the live collection."""
  with self.publish_lock:
   subprocess.run(['git','merge','--ff-only','main'],cwd=self.work,check=True)
   target=self.work/'crawl-stages'/self.args.run_id/slug;target.mkdir(parents=True,exist_ok=True)
   if stage=='gallery':
    snapshot={k:report.get(k) for k in ['builder','status','startedAt','completedAt','developments','properties','images','errors','metrics']}
   elif stage=='website':snapshot=legacy.read_json(folder/'direct-categories.json',{})
   else:snapshot={'builder':slug,'completedAt':now(),'images':len(report['images']),'siteCategorised':sum(i.get('categorisation',{}).get('categorisationSource')=='website-html' for i in report['images']),'aiCategorised':sum(bool(i.get('verdict')) for i in report['images']),'sourceErrors':report.get('errors',[])}
   snapshot['stage']=stage;snapshot['recordedAt']=now();path=target/f'{stage}.json';legacy.save_json(path,snapshot)
   files=[str(path.relative_to(self.work))]
   if stage=='ai':
    collection=self.work/'collections'/f'{slug}-home-offices'
    files.extend(str(p.relative_to(self.work)) for p in collection.iterdir() if p.is_file() and p.suffix in ('.json','.html','.csv'))
   subprocess.run(['git','add','--',*files],cwd=self.work,check=True)
   subprocess.run(['git','diff','--cached','--check'],cwd=self.work,check=True)
   subprocess.run(['git','commit','-m',f'Complete {slug} {stage} processing'],cwd=self.work,check=True)
   subprocess.run(['git','rebase','main'],cwd=self.work,check=True)
   subprocess.run(['git','merge','--ff-only','codex/sequential-builder-recrowls'],cwd=ROOT,check=True)
   subprocess.run(['git','push','origin','main'],cwd=ROOT,check=True)
   return subprocess.check_output(['git','rev-parse','HEAD'],cwd=self.work,text=True).strip()
 def process(self,slug,stage):
  folder=self.folder(slug);relative=str(folder.relative_to(ROOT));report=legacy.read_json(folder/'results.json')
  if stage=='gallery':
   if (folder/'.lock').exists():
    with self.state_lock:self.state['streams'][stage]={'builder':slug,'status':'running','adopted':True,'log':str((LOGS/f'{slug}-pipeline-gallery.log').relative_to(ROOT))}
    self.save()
    while (folder/'.lock').exists():time.sleep(3)
    report=legacy.read_json(folder/'results.json')
   if not report or report.get('status') not in ('completed','completed_with_gaps'):
    checkpoint=legacy.read_json(folder/'checkpoint.json',{})
    command=['npx','tsx','src/cli/crawl.ts','--builder',slug,'--all-images','--discover-only','--output',relative,'--min-bedrooms','1','--max-developments','1000','--max-properties','10000','--max-images','100000']
    command+=['--resume'] if checkpoint.get('analysisVersion')=='all-property-images-v1' and checkpoint.get('status') in ('running','cancelled','failed') else ['--refresh-pages']
    self.run(slug,stage,command);report=legacy.read_json(folder/'results.json',{})
   legacy.validate_collection(report)
  elif stage=='website':
   self.run(slug,stage,['python3','scripts/direct-image-categories.py','--folder',relative,'--apply']);report=legacy.read_json(folder/'results.json',{})
  else:
   self.run(slug,stage,['npx','tsx','src/cli/classify-stream.ts','--folder',relative,'--all-images','--model','gemini-3.1-flash-lite'])
   self.run(slug,stage,['npx','tsx','src/cli/classify-results.ts','--folder',relative,'--all-images','--model','gemini-3.1-flash-lite'])
   report=legacy.read_json(folder/'results.json',{});legacy.validate_collection(report)
   if any(not i.get('categorisation') for i in report['images']):raise ValueError('Uncategorised images remain')
   # Finalizer targets the canonical folder. Other streams never touch this builder.
   canonical=ROOT/'results'/f'{slug}-home-offices'
   if folder!=canonical:
    if canonical.exists():canonical.rename(canonical.with_name(canonical.name+f'-backup-{time.time_ns()}'))
    folder.rename(canonical);folder=canonical
    with self.state_lock:self.state['builders'][slug]['folder']=str(folder.relative_to(ROOT))
   with self.publish_lock:
    subprocess.run(['git','merge','--ff-only','main'],cwd=self.work,check=True)
    self.run(slug,stage,['npx','tsx','src/cli/finalize-builder.ts','--builder',slug],cwd=self.work)
    self.run(slug,stage,['npm','run','typecheck'],cwd=self.work)
   report=legacy.read_json(folder/'results.json',{})
  commit=self.checkpoint(slug,stage,folder,report)
  if stage=='ai':
   shutil.copytree(self.work/'collections'/f'{slug}-home-offices'/'images',ROOT/'collections'/f'{slug}-home-offices'/'images',dirs_exist_ok=True)
  return {'status':'complete','completedAt':now(),'commit':commit,'images':len(report['images'])}
 def execute(self):
  # Preserve previous publications; review jobs have separate, fresh candidate folders.
  manifest=legacy.read_json(legacy.MANIFEST,{})
  for slug in self.order:
   if slug not in self.state['builders'] and manifest.get(slug,{}).get('status')=='published' and slug not in ('bellway','cala','barratt'):
    self.state['builders'][slug]={stage:{'status':'complete','imported':True} for stage in STAGES}
   if slug in ('bellway','cala','barratt') and slug not in self.state['builders']:
    self.state['builders'][slug]={'folder':f'results/{slug}-pipeline-review-{self.args.run_id}'}
  self.save();active={};futures={}
  with ThreadPoolExecutor(max_workers=3) as workers:
   while True:
    for stage,future in list(futures.items()):
     if not future.done():continue
     slug=active.pop(stage);del futures[stage]
     try:result=future.result()
     except Exception as error:result={'status':'failed','error':str(error),'failedAt':now()}
     self.state['builders'][slug][stage]=result;self.state['streams'][stage]={'builder':slug,**result};self.save()
    paused=legacy.read_json(legacy.CONTROL,{}).get('pauseAfterCurrentBuilder',False)
    for stage in STAGES:
     if paused or stage in futures:continue
     slug=eligible(stage,self.order,self.state['builders'],set(active.values()))
     if slug:
      self.state['builders'].setdefault(slug,{})[stage]={'status':'running','startedAt':now()}
      active[stage]=slug;self.save();futures[stage]=workers.submit(self.process,slug,stage)
    if not futures:
     self.state['status']='paused' if paused else 'needs_attention' if any(v.get('status')=='failed' for b in self.state['builders'].values() for v in b.values() if isinstance(v,dict)) else 'complete'
     self.save();return
    time.sleep(3)
def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--run-id',default='20261003');parser.add_argument('--worktree',default='/tmp/showhome-sequential-recrowls');args=parser.parse_args()
 lock=CACHE/'builder-pipeline.lock'
 if lock.exists():
  pid=legacy.read_json(lock,{}).get('pid')
  try:os.kill(pid,0)
  except (ProcessLookupError,TypeError):lock.unlink()
  else:raise RuntimeError('Pipeline already running')
 with lock.open('x') as file:json.dump({'pid':os.getpid()},file)
 try:Pipeline(args).execute()
 finally:lock.unlink(missing_ok=True)
if __name__=='__main__':main()
