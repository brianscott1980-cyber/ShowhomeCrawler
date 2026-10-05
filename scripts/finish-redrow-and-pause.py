"""Finish HTML labelling for the in-flight Redrow run without starting another builder."""
import datetime,json,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
manifest=ROOT/'results/.cache/remaining-builder-scan-state.json'
state=json.loads(manifest.read_text())['redrow'];folder=ROOT/state['folder']
while True:
 reportPath=folder/'results.json'
 if reportPath.exists() and not (folder/'.lock').exists():
  report=json.loads(reportPath.read_text())
  if report.get('status') in ['completed','completed_with_gaps']:break
 time.sleep(5)
subprocess.run(['python3','scripts/direct-image-categories.py','--folder',state['folder'],'--apply'],cwd=ROOT,check=True)
report=json.loads(reportPath.read_text());direct=json.loads((folder/'direct-categories.json').read_text())
if any(image.get('verdict') or image.get('analysisModel') for image in report['images']):raise ValueError('Unexpected AI labels')
data=json.loads(manifest.read_text());data['redrow']={**state,'status':'html_only_complete','completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'developments':len(report['developments']),'galleries':len(report['properties']),'images':len(report['images']),'htmlCategorised':len(direct['images']),'uncategorised':sum(not image.get('categorisation') for image in report['images']),'errors':len(report['errors'])}
tmp=manifest.with_suffix('.tmp');tmp.write_text(json.dumps(data,indent=2));tmp.replace(manifest)
print(json.dumps(data['redrow']),flush=True)
print('Stopped after Redrow; Springfield and Story remain pending.',flush=True)
