#!/usr/bin/env python3
"""Resume local collection and categorisation, Bellway/Landsdale first; no Git publication."""
import datetime,json,os,re,shutil,subprocess,time
from pathlib import Path
from threading import Lock,Thread
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'results/.cache';LOGS=CACHE/'recrawl-logs'
LOCK=Lock();STATE=CACHE/'builder-pipeline-state.json';MANIFEST=CACHE/'remaining-builder-scan-state.json'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def read(path,default=None):
 try:return json.loads(path.read_text())
 except (OSError,ValueError):return default

def save(path,value):
 temp=path.with_name(path.name+'.resume.tmp');temp.write_text(json.dumps(value,indent=2)+'\n');temp.replace(path)
registry=list(dict.fromkeys(re.findall(r"slug:\s*'([^']+)',\s*name:",(ROOT/'src/adapters/developers.ts').read_text())))
order=list(dict.fromkeys(['bellway','springfield','story-homes',*(ROOT/'docs/nhbc-builder-crawl-order.txt').read_text().splitlines(),*registry]))
order=[slug for slug in order if slug in registry]
state={'status':'running','supervisorPid':os.getpid(),'startedAt':now(),'order':order,'streams':{},'builders':{}}
manifest=read(MANIFEST,{})
def update(slug,stage,status,**extra):
 with LOCK:
  state['builders'].setdefault(slug,{})[stage]={'status':status,'updatedAt':now(),**extra}
  state['streams'][stage]={'builder':slug,'status':status,**extra}
  state['updatedAt']=now();save(STATE,state)
def record(slug,**extra):
 with LOCK:
  manifest.setdefault(slug,{}).update(extra);save(MANIFEST,manifest)
def run(slug,stage,command):
 path=LOGS/f'{slug}-resumed-{stage}.log'
 with path.open('a') as output:
  proc=subprocess.Popen(command,cwd=ROOT,stdout=output,stderr=subprocess.STDOUT)
  update(slug,stage,'running',pid=proc.pid,log=str(path.relative_to(ROOT)))
  if proc.wait():raise RuntimeError(f'{stage} failed; see {path.relative_to(ROOT)}')

def collect():
 for slug in order:
  if read(CACHE/'recrawl-control.json',{}).get('pauseAfterCurrentBuilder'):break
  try:
   folder=manifest.get(slug,{}).get('folder');report=read(ROOT/folder/'results.json') if folder else None
   reusable=report and report.get('status') in ('completed','completed_with_gaps') and report.get('images') and not any(report.get('metrics',{}).get(k,0) for k in ('propertyLimitOmissions','imageLimitOmissions','developmentLimitOmissions'))
   if not reusable:
    # Delete only unlinked raw cache files; downloaded collection images stay intact.
    for path in CACHE.glob('*.bin'):
     if shutil.disk_usage(ROOT).free>=8*1024**3:break
     if path.stat().st_nlink==1:path.unlink()
    if shutil.disk_usage(ROOT).free<1024**3:raise RuntimeError('Less than 1 GB free; collection suspended to protect existing data')
    folder=f'results/{slug}-unrestricted-{datetime.datetime.now().strftime("%Y%m%d-%H%M%S")}'
    record(slug,folder=folder,status='scanning',htmlOnly=False,startedAt=now())
    run(slug,'gallery',['npx','tsx','src/cli/crawl.ts','--builder',slug,'--all-images','--discover-only','--refresh-pages','--output',folder,'--max-developments','1000','--max-properties','10000','--max-images','100000'])
   with LOCK:state['builders'].setdefault(slug,{})['folder']=folder
   update(slug,'gallery','complete');record(slug,folder=folder,htmlOnly=False,status='categorising_html')
   run(slug,'website',['python3','scripts/direct-image-categories.py','--folder',folder,'--apply'])
   report=read(ROOT/folder/'results.json',{})
   record(slug,status='awaiting_ai',developments=len(report.get('developments',[])),galleries=len(report.get('properties',[])),images=len(report.get('images',[])))
   update(slug,'website','complete')
  except Exception as error:
   record(slug,status='needs_review',error=str(error));update(slug,'gallery','failed',error=str(error))
   if 'Less than 1 GB' in str(error):break
 with LOCK:state['collectionFinished']=True;save(STATE,state)
def categorise():
 for slug in order:
  while True:
   with LOCK:
    builder=state['builders'].get(slug,{})
    ready=builder.get('website',{}).get('status')=='complete';failed=builder.get('gallery',{}).get('status')=='failed';finished=state.get('collectionFinished',False)
   if ready or failed or finished:break
   time.sleep(3)
  if not ready:continue
  if read(CACHE/'recrawl-control.json',{}).get('pauseAfterCurrentBuilder'):break
  folder=state['builders'][slug]['folder'];record(slug,status='categorising',htmlOnly=False)
  try:
   command=['npx','tsx','src/cli/classify-results.ts','--folder',folder,'--all-images','--model','gemini-3.1-flash-lite']
   if slug=='bellway':command+=['--priority-development','Landsdale']
   run(slug,'ai',command)
   report=read(ROOT/folder/'results.json',{})
   pending=sum(not image.get('categorisation') for image in report.get('images',[]))
   if pending:raise RuntimeError(f'{pending} images remain uncategorised')
   record(slug,status='categorised_complete',completedAt=now(),uncategorised=0)
   update(slug,'ai','complete',images=len(report.get('images',[])))
  except Exception as error:record(slug,status='needs_review',error=str(error));update(slug,'ai','failed',error=str(error))

def main():
 CACHE.mkdir(exist_ok=True,parents=True);LOGS.mkdir(exist_ok=True,parents=True)
 lock=CACHE/'resumed-builder-pipeline.lock'
 if lock.exists():
  pid=read(lock,{}).get('pid')
  try:os.kill(pid,0)
  except (ProcessLookupError,TypeError):lock.unlink()
  else:raise RuntimeError('Resume pipeline already running')
 save(lock,{'pid':os.getpid()})
 try:
  control=read(CACHE/'recrawl-control.json',{})
  control.update(paused=False,pauseAfterCurrentBuilder=False,activeBuilder='bellway',discoveryOnly=False,resumedAt=now(),reason='User resumed all outstanding builders and requested AI categorisation, Bellway/Landsdale first')
  control.pop('stopAfterBuilder',None);save(CACHE/'recrawl-control.json',control)
  for request in read(ROOT/'docs/builder-crawl-requests.json',{}).get('builders',[]):
   if request['slug'] not in registry:record(request['slug'],status='needs_review',error='Builder adapter and website research required before collection')
  save(STATE,state)
  worker=Thread(target=collect);worker.start();categorise();worker.join()
  state['status']='needs_attention' if any(stage.get('status')=='failed' for builder in state['builders'].values() for stage in builder.values() if isinstance(stage,dict)) else 'complete';save(STATE,state)
 finally:lock.unlink(missing_ok=True)
if __name__=='__main__':main()
