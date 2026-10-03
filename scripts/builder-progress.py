import json,re,datetime,threading,hashlib,os
from collections import Counter
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
ROOT=Path(__file__).resolve().parents[1]
QUEUE=ROOT/'docs/builder-recrawl-order.txt'
CACHE={};ANALYSES={};MUTEX=threading.Lock()
MODELS=['gemini-3.1-flash-lite','gemini-2.5-flash-lite','gemini-3.5-flash-lite']
def stats(path):
 try:
  st=path.stat();stamp=(st.st_mtime_ns,st.st_size)
  if path in CACHE and CACHE[path][0]==stamp:return CACHE[path][1]
  r=json.loads(path.read_text());v={'status':r.get('status'),'startedAt':r.get('startedAt',''),'galleries':len(r.get('properties',[])),'totalGalleries':r.get('metrics',{}).get('qualifyingDiscovered',len(r.get('properties',[]))),'images':len(r.get('images',[])),'categorised':sum(bool(i.get('categorisation')) for i in r.get('images',[])),'sourceGaps':sum(e.get('stage')!='classification' for e in r.get('errors',[])),'name':r.get('builder',{}).get('name'),'modelsUsed':dict(Counter(i.get('analysisModel') or r.get('model','unknown') for i in r.get('images',[]) if i.get('verdict'))),'selectedModel':r.get('model'),'skippedGalleries':r.get('metrics',{}).get('skippedCompletedGalleries'),'sharedGalleries':r.get('metrics',{}).get('reusedGalleries',0),'skippedImages':r.get('metrics',{}).get('reusedImages',0)+r.get('metrics',{}).get('reusedImageSources',0),'skippedAnalyses':r.get('metrics',{}).get('skippedExistingAnalyses',0)+r.get('metrics',{}).get('analysisCacheHits',0),'_pendingIds':[i['id'] for i in r.get('images',[]) if not i.get('categorisation')]}
  CACHE[path]=(stamp,v);return v
 except (OSError,ValueError,TypeError):return CACHE.get(path,(None,None))[1]
def cached_analyses(ids):
 counts=Counter()
 for image_id in ids:
  for model in MODELS:
   key=hashlib.sha256(f'{image_id}:{model}:all-property-images-v1'.encode()).hexdigest()
   path=ROOT/'results/.cache/analysis'/f'{key}.json'
   try:
    st=path.stat();stamp=(st.st_mtime_ns,st.st_size)
    if path in ANALYSES and ANALYSES[path][0]==stamp:valid=ANALYSES[path][1]
    else:
     a=json.loads(path.read_text())
     valid=all(isinstance(a.get(k),bool) for k in ['matches','hasDesk','hasBed']) and all(isinstance(a.get(k),str) for k in ['roomType','description','reason']) and a.get('analysisSource')!='filename-inference' and not re.search(r'interior showing (?:contemporary design, styling and finishes|styling and furnishings)\.',a.get('description',''),re.I)
     ANALYSES[path]=(stamp,valid)
    if valid:counts[model]+=1;break
   except (OSError,ValueError,TypeError):pass
 return counts
def latest_stats(folder):
 paths=[p for p in [folder/'results.json',folder/'checkpoint.json'] if p.exists()]
 return stats(max(paths,key=lambda p:p.stat().st_mtime_ns)) if paths else None
def data():
 with MUTEX:
  names=dict(re.findall(r"slug:\s*'([^']+)',\s*name:\s*'([^']+)'",(ROOT/'src/adapters/developers.ts').read_text()))
  order=[s for s in dict.fromkeys(QUEUE.read_text().splitlines()) if re.fullmatch(r'[a-z0-9-]+',s)]
  try:manifest=json.loads((ROOT/'results/.cache/remaining-builder-scan-state.json').read_text())
  except (OSError,ValueError):manifest={}
  try:published_log=Path('/tmp/showhome-recrawl-sequence.log').read_text()
  except OSError:published_log=''
  try:
   log=max([*Path('/tmp').glob('showhome-*-recrawl-analysis.log'),*Path('/tmp').glob('showhome-*-recrawl-final-analysis.log')],key=lambda p:p.stat().st_mtime)
   quota=log.read_text()[-2048:].strip().endswith('Pausing for 2 minutes before retrying...')
  except (OSError,ValueError):quota=False
  try:control=json.loads((ROOT/'results/.cache/recrawl-control.json').read_text());pause=control.get('pauseAfterCurrentBuilder',False)
  except (OSError,ValueError):control={};pause=False
  active=control.get('activeBuilder','')
  worker={}
  if re.fullmatch(r'[a-z0-9-]+',active):
   paths=[p for p in [ROOT/'results'/f'{active}-home-offices/gemini-state.json',ROOT/'results'/f'{active}-unrestricted-scan-20261003/gemini-state.json'] if p.exists()]
   if paths:
    try:worker=json.loads(max(paths,key=lambda p:p.stat().st_mtime_ns).read_text())
    except (OSError,ValueError):pass
  if worker:quota=worker.get('state')=='quota_wait'
  builders=[]
  for slug in order:
   state=manifest.get(slug,{})
   candidate=ROOT/'results'/f'{slug}-unrestricted-scan-20261003'
   canonical=ROOT/'results'/f'{slug}-home-offices'
   scan=latest_stats(candidate)
   canon=latest_stats(canonical)
   current=scan
   if canon and ((scan and canon['startedAt']>=scan['startedAt']) or (slug=='bellway' and canon['startedAt'].startswith('2026-10-03'))):current=canon
   if current:
    current=dict(current);current['modelsUsed']=dict(current.get('modelsUsed',{}));cached=cached_analyses(current.get('_pendingIds',[]));current['categorised']+=sum(cached.values());current['skippedAnalyses']+=sum(cached.values())
    for model,count in cached.items():current['modelsUsed'][model]=current['modelsUsed'].get(model,0)+count
   pushed=f'{slug} published and pushed at ' in published_log
   phase='Queued'
   if current:
    if current['status'] in ['running','classifying']:phase='Categorising' if current['status']=='classifying' else ('Reviewing' if pushed else 'Scanning')
    elif state.get('status') in ['failed','needs_review']:phase='Needs source review'
    elif current['images'] and current['categorised']==current['images'] and pushed:phase='Published'
    elif current['images']:phase='Collected · awaiting categorisation'
    else:phase='Needs source review'
   builders.append({'slug':slug,'name':(current or {}).get('name') or names.get(slug,slug),'phase':phase,**({k:v for k,v in current.items() if k not in ['name','status'] and not k.startswith('_')} if current else {'galleries':0,'totalGalleries':0,'images':0,'categorised':0,'sourceGaps':0})})
  return {'updatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'quotaBlocked':quota,'pauseAfterCurrentBuilder':pause,'activeBuilder':active,'gemini':{'state':({'quota_wait':'Waiting for quota · HTTP 429','analysing':'Analysing images','retrying':'Retrying request','complete':'Analysis worker finished'}.get(worker.get('state'),'No live worker status available')+(' · Retry scheduled: '+worker['retryAt'] if worker.get('retryAt') else '')) if worker else ('Waiting for quota · HTTP 429' if quota else 'No live worker status available'),'selectedModel':worker.get('model','gemini-3.1-flash-lite'),'fallbackModels':worker.get('fallbackModels',MODELS),'modelStates':worker.get('modelStates',[]),'retry':'Switch models immediately on quota; retry the pool every 2 minutes when all are exhausted','modelsUsed':dict(Counter({model:sum(b.get('modelsUsed',{}).get(model,0) for b in builders) for model in {m for b in builders for m in b.get('modelsUsed',{})}}))},'builders':builders,'summary':{'builders':len(builders),'collected':sum(b['phase'] in ['Collected · awaiting categorisation','Published','Categorising'] for b in builders),'published':sum(b['phase']=='Published' for b in builders),'images':sum(b['images'] for b in builders),'categorised':sum(b['categorised'] for b in builders)}}
HTML='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Builder scan progress</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f2eb;color:#15243a;font:15px/1.5 system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:32px 24px}header{display:flex;justify-content:space-between;gap:24px;align-items:center}h1{font:38px Georgia,serif;margin:8px 0}p{margin:8px 0}.muted{color:#657181;font-size:13px}.notice{background:#15243a;color:white;padding:16px 20px;margin:24px 0}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:24px 0}.stat{border-bottom:1px solid #d3d7d9;padding:16px 0}.stat strong{font:32px Georgia,serif;display:block}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.card{background:white;border:1px solid #d3d7d9;padding:20px}.card h2{font:22px Georgia,serif;margin:0 0 6px}.phase{font-size:12px;color:#52647b;margin:0 0 16px}.metrics{display:flex;justify-content:space-between;gap:12px;font-size:13px;margin:8px 0}.bar{height:5px;background:#eceef0;overflow:hidden}.bar span{display:block;height:100%;background:#15243a;transition:width .5s}.bar.categorisation span{background:#a7553e}.gap{font-size:12px;color:#945532;margin-top:12px}.active{border-color:#a7553e}.summary span{font-size:12px;color:#657181}@media(max-width:650px){header{align-items:start;flex-direction:column;gap:4px}.grid{grid-template-columns:1fr}.summary{grid-template-columns:1fr 1fr}main{padding:20px}h1{font-size:32px}}</style>
<main><header><div><p class="muted">UK SHOWHOME EXPLORER</p><h1>Builder scan progress</h1></div><p class="muted" id="updated">Connecting…</p></header><div class="notice" id="notice">Loading live progress…</div><section class="notice" aria-label="Gemini status"><strong>Gemini status</strong><p id="gemini-state"></p><p id="gemini-models"></p><p id="gemini-fallbacks"></p><p>Room categories are extracted from Gemini’s visual descriptions.</p></section><section class="summary" id="summary"></section><section class="grid" id="builders"></section><p class="muted">Original builder order. Collection has no study, price or bedroom restrictions. Published collections are replaced only after categorisation and validation. Bellway, Cala and Barratt receive a final fresh review after the remaining builders.</p></main>
<script>
const fmt=n=>new Intl.NumberFormat('en-GB').format(n), nodes=new Map();
const metric=(label,value)=>{const el=document.createElement('div');el.className='stat';const v=document.createElement('strong');v.textContent=value;const l=document.createElement('span');l.textContent=label;el.append(v,l);return el};
function card(b,index){let el=nodes.get(b.slug);if(!el){el=document.createElement('article');el.className='card';el.innerHTML='<h2></h2><p class="phase"></p><div class="metrics"><span>Galleries reached</span><strong class="galleries"></strong></div><div class="bar"><span class="collection-fill"></span></div><div class="metrics"><span>Distinct images collected</span><strong class="images"></strong></div><div class="metrics"><span>Images visually analysed</span><strong class="categorised"></strong></div><div class="bar categorisation"><span class="category-fill"></span></div><div class="metrics"><span>Completed galleries skipped</span><strong class="skipped-galleries"></strong></div><div class="metrics"><span>Shared galleries skipped</span><strong class="shared-galleries"></strong></div><div class="metrics"><span>Duplicate images skipped</span><strong class="skipped-images"></strong></div><div class="metrics"><span>Gemini analyses reused</span><strong class="skipped-analyses"></strong></div><p class="gap"></p>';nodes.set(b.slug,el);document.getElementById('builders').append(el)}el.classList.toggle('active',['Scanning','Reviewing','Categorising'].includes(b.phase));el.querySelector('h2').textContent=(index+1)+'. '+b.name;el.querySelector('.phase').textContent=b.phase;el.querySelector('.galleries').textContent=b.totalGalleries?fmt(b.galleries)+' / '+fmt(b.totalGalleries):'—';el.querySelector('.images').textContent=fmt(b.images);el.querySelector('.categorised').textContent=b.images?fmt(b.categorised)+' / '+fmt(b.images):'—';el.querySelector('.collection-fill').style.width=(b.totalGalleries?Math.min(100,100*b.galleries/b.totalGalleries):0)+'%';el.querySelector('.category-fill').style.width=(b.images?100*b.categorised/b.images:0)+'%';el.querySelector('.skipped-galleries').textContent=b.skippedGalleries==null?'Not recorded':fmt(b.skippedGalleries);el.querySelector('.shared-galleries').textContent=fmt(b.sharedGalleries||0);el.querySelector('.skipped-images').textContent=fmt(b.skippedImages||0);el.querySelector('.skipped-analyses').textContent=fmt(b.skippedAnalyses||0);el.querySelector('.gap').textContent=b.sourceGaps?fmt(b.sourceGaps)+' source gap'+(b.sourceGaps===1?'':'s')+' recorded for review':'';}
async function refresh(){try{const response=await fetch('/api/progress',{cache:'no-store'});if(!response.ok)throw new Error();const d=await response.json();document.getElementById('updated').textContent='Updated '+new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(d.updatedAt))+' · refreshes every 10 seconds';document.getElementById('notice').textContent=d.pauseAfterCurrentBuilder?(d.activeBuilder?'Completing '+d.activeBuilder+' only. The remaining builder queue is paused.':'Pause requested after the current builder. No further builders will be started.'):d.quotaBlocked?'Collection scans continue. Categorisation is waiting for Gemini’s daily quota.':'Collection, categorisation and publication progress are shown below.';const g=d.gemini;document.getElementById('gemini-fallbacks').textContent='Fallback pool: '+g.fallbackModels.join(' → ')+' · '+g.modelStates.map(m=>m.model+': '+m.status).join(', ');document.getElementById('gemini-state').textContent=g.state+' · '+g.retry;document.getElementById('gemini-models').textContent='Selected model: '+g.selectedModel+' · Models used: '+(Object.entries(g.modelsUsed).map(([m,n])=>m+' ('+fmt(n)+' images)').join(', ')||'No completed analyses');const s=d.summary;document.getElementById('summary').replaceChildren(metric('Builders with collection complete',s.collected+' / '+s.builders),metric('Images collected',fmt(s.images)),metric('Images visually analysed',fmt(s.categorised)),metric('Builders published',s.published+' / '+s.builders));d.builders.forEach(card)}catch{document.getElementById('updated').textContent='Connection interrupted · retrying…'}}refresh();setInterval(refresh,10000);
</script></html>'''
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  if self.path=='/api/progress':payload=json.dumps(data()).encode();kind='application/json'
  elif self.path=='/':payload=HTML.encode();kind='text/html; charset=utf-8'
  else:self.send_error(404);return
  self.send_response(200);self.send_header('Content-Type',kind);self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(payload)));self.end_headers();self.wfile.write(payload)
 def log_message(self,*args):pass
if __name__=='__main__':
 port=int(os.environ.get('BUILDER_PROGRESS_PORT','8767'))
 print(f'Live builder progress: http://localhost:{port}',flush=True)
 ThreadingHTTPServer(('127.0.0.1',port),Handler).serve_forever()
