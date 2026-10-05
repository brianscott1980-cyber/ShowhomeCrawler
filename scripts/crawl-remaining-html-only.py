"""Finish the nine formerly bedroom-restricted builders, preserving HTML-only mode."""
import argparse,json,os,shutil,time
from pathlib import Path
import importlib.util
spec=importlib.util.spec_from_file_location('html_crawl',Path(__file__).with_name('crawl-html-only.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
crawl=module.crawl
ROOT=Path(__file__).resolve().parents[1]
BUILDERS=['robertson-homes','berkeley-group','crest-nicholson','hill-group','miller-homes','persimmon','redrow','springfield','story-homes']

def reclaim_cache():
 for path in (ROOT/'results/.cache').glob('*.bin'):
  if shutil.disk_usage(ROOT).free>=8*1024**3:break
  if path.stat().st_nlink==1:path.unlink()

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--wait-pid',type=int);args=parser.parse_args()
 if args.wait_pid:
  while True:
   try:os.kill(args.wait_pid,0)
   except ProcessLookupError:break
   time.sleep(10)
 for builder in BUILDERS:
  state=json.loads((ROOT/'results/.cache/remaining-builder-scan-state.json').read_text())
  if state.get(builder,{}).get('status')=='html_only_complete':
   print('Already completed: '+builder,flush=True);continue
  reclaim_cache()
  if shutil.disk_usage(ROOT).free<1024**3:
   print('Queue stopped: insufficient disk space before '+builder,flush=True);return
  try:crawl(builder)
  except Exception as error:print('Needs review: '+builder+' '+str(error),flush=True)
 print('Remaining HTML-only builder queue finished',flush=True)

if __name__=='__main__':main()
