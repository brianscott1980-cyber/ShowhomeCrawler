#!/usr/bin/env python3
"""Commit completed crawl stages and categorised catalogues without staging other work."""
import datetime,json,os,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];CACHE=ROOT/'results/.cache'
SAVED=CACHE/'crawl-git-checkpoints.json'
def read(path,default=None):
 try:return json.loads(path.read_text())
 except (OSError,ValueError):return default
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
def save(path,value):
 path.parent.mkdir(parents=True,exist_ok=True);tmp=path.with_name(path.name+'.git.tmp');tmp.write_text(json.dumps(value,indent=2)+'\n');tmp.replace(path)
def process(pipeline,done):
 if git('branch','--show-current')!='main':return
 if git('diff','--cached','--name-only'):return
 for slug,builder in pipeline.get('builders',{}).items():
  for stage in ('gallery','website','ai'):
   completed=builder.get(stage,{})
   if completed.get('status')!='complete':continue
   key=f'{pipeline.get("startedAt")}:{slug}:{stage}'
   if key in done:continue
   folder=ROOT/builder.get('folder','results/.cache');report=read(folder/'results.json',{})
   if not report.get('images'):continue
   checkpoint=ROOT/'docs/crawl-checkpoints'/f'{slug}-{stage}.json'
   summary={'builder':slug,'stage':stage,'recordedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'developments':len(report.get('developments',[])),'houseTypes':len(report.get('properties',[])),'images':len(report.get('images',[])),'htmlCategorised':sum(i.get('categorisation',{}).get('categorisationSource')=='website-html' for i in report['images']),'aiCategorised':sum(bool(i.get('analysisModel')) for i in report['images']),'sourceErrors':sum(e.get('stage')!='classification' for e in report.get('errors',[]))}
   save(checkpoint,summary);paths=[str(checkpoint.relative_to(ROOT))]
   if stage=='ai':
    if report.get('status') not in ('completed','completed_with_gaps') or any(not image.get('categorisation') for image in report['images']):continue
    if any(report.get('metrics',{}).get(k,0) for k in ('propertyLimitOmissions','imageLimitOmissions','developmentLimitOmissions')):continue
    target=ROOT/'collections'/f'{slug}-home-offices'/'results.json';save(target,report);paths.append(str(target.relative_to(ROOT)))
   subprocess.run(['git','add','--',*paths],cwd=ROOT,check=True)
   subprocess.run(['git','diff','--cached','--check'],cwd=ROOT,check=True)
   subprocess.run(['git','commit','-m',f'Save {slug} {stage} crawl checkpoint'],cwd=ROOT,check=True)
   done[key]={'commit':git('rev-parse','HEAD'),'pushed':False};save(SAVED,done)
   subprocess.run(['git','push','origin','main'],cwd=ROOT,check=True)
   done[key]['pushed']=True;save(SAVED,done)
   print(f'Committed and pushed {slug} {stage}: {done[key]["commit"]}',flush=True)
   if git('diff','--cached','--name-only'):return

def main():
 lock=CACHE/'crawl-git-checkpoints.lock'
 if lock.exists():
  pid=read(lock,{}).get('pid')
  try:os.kill(pid,0)
  except (ProcessLookupError,TypeError):lock.unlink()
  else:raise RuntimeError('Commit watcher already running')
 save(lock,{'pid':os.getpid()});done=read(SAVED,{})
 try:
  while True:
   pipeline=read(CACHE/'builder-pipeline-state.json',{})
   try:
    if any(not entry.get('pushed') for entry in done.values()):
     subprocess.run(['git','push','origin','main'],cwd=ROOT,check=True)
     for entry in done.values():entry['pushed']=True
     save(SAVED,done)
    process(pipeline,done)
   except subprocess.CalledProcessError as error:print(f'Git checkpoint needs review; retrying later: {error}',flush=True)
   if pipeline.get('status') in ('complete','needs_attention','paused') and all(e.get('pushed') for e in done.values()):break
   time.sleep(30)
 finally:lock.unlink(missing_ok=True)
if __name__=='__main__':main()
