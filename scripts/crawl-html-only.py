"""Run one unrestricted builder collection followed by HTML labels only, never AI."""
import argparse,datetime,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def crawl(builder):
 registry=(ROOT/'src/adapters/developers.ts').read_text()
 if f"'{builder}'" not in registry:raise ValueError('Unknown builder')
 folder='results/'+builder+'-html-only-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
 manifest=ROOT/'results/.cache/remaining-builder-scan-state.json'
 def update(status,**extra):
  data=json.loads(manifest.read_text()) if manifest.exists() else {};data[builder]={'status':status,'folder':folder,'startedAt':started,'htmlOnly':True,**extra};temporary=manifest.with_suffix('.tmp');temporary.write_text(json.dumps(data,indent=2));temporary.replace(manifest)
 started=now();update('scanning');print(folder,flush=True)
 control=ROOT/'results/.cache/recrawl-control.json'
 settings=json.loads(control.read_text()) if control.exists() else {}
 settings.update(activeBuilder=builder,discoveryOnly=True,pauseAfterCurrentBuilder=True,reason='User requested sequential unrestricted HTML-only crawls; general queue remains paused')
 control.write_text(json.dumps(settings,indent=2))
 try:
  subprocess.run(['npx','tsx','src/cli/crawl.ts','--builder',builder,'--all-images','--discover-only','--refresh-pages','--output',folder,'--max-developments','1000','--max-properties','10000','--max-images','100000'],cwd=ROOT,check=True)
  update('categorising_html')
  subprocess.run(['python3','scripts/direct-image-categories.py','--folder',folder,'--apply'],cwd=ROOT,check=True)
  report=json.loads((ROOT/folder/'results.json').read_text());direct=json.loads((ROOT/folder/'direct-categories.json').read_text())
  if any(image.get('verdict') or image.get('analysisModel') for image in report['images']):raise ValueError('Unexpected AI labels in HTML-only run')
  summary={'completedAt':now(),'developments':len(report['developments']),'galleries':len(report['properties']),'images':len(report['images']),'htmlCategorised':len(direct['images']),'uncategorised':sum(not image.get('categorisation') for image in report['images']),'errors':len(report['errors'])}
  update('html_only_complete',**summary);print(json.dumps(summary),flush=True)
 except Exception as error:update('needs_review',error=str(error));raise
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--builder',required=True,action='append');args=parser.parse_args()
 for builder in args.builder:crawl(builder)
