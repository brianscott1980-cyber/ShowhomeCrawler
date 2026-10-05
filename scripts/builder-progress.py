import json,re,datetime,threading,hashlib,os,time,math
from collections import Counter
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
ROOT=Path(__file__).resolve().parents[1]
QUEUE=ROOT/'docs/nhbc-builder-crawl-order.txt'
if not QUEUE.exists():QUEUE=ROOT/'docs/builder-recrawl-order.txt'
CACHE={};ANALYSES={};MUTEX=threading.Lock()
MODELS=['gemini-3.1-flash-lite','gemini-2.5-flash-lite','gemini-3.5-flash-lite']
ETA_SAMPLES={}
def crawl_eta(slug, current, now=None):
 now=time.monotonic() if now is None else now
 done=current['galleries'];total=current['totalGalleries']
 if not total:return {'state':'estimating'}
 remaining=max(0,total-done)
 if not remaining:return {'state':'finishing'}
 key=(slug,current['startedAt']);samples=ETA_SAMPLES.setdefault(key,[])
 if samples and done<samples[-1][1]:samples.clear()
 samples.append((now,done))
 while len(samples)>2 and samples[1][0]<now-900:samples.pop(0)
 if now-samples[0][0]<30:return {'state':'estimating'}
 advanced=done-samples[0][1]
 if advanced<=0:return {'state':'waiting'}
 last_change=next((t for t,n in reversed(samples) if n<done),samples[0][0])
 if now-last_change>120:return {'state':'waiting'}
 rate=advanced/(now-samples[0][0])
 seconds=math.ceil(remaining/rate)
 finish=datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=seconds)
 return {'state':'estimated','secondsRemaining':seconds,'finishAt':finish.isoformat(),'galleriesPerMinute':round(rate*60,1)}
def stats(path):
 try:
  st=path.stat();direct_path=path.parent/'direct-categories.json'
  direct_stamp=direct_path.stat().st_mtime_ns if direct_path.exists() else 0
  stamp=(st.st_mtime_ns,st.st_size,direct_stamp)
  if path in CACHE and CACHE[path][0]==stamp:return CACHE[path][1]
  r=json.loads(path.read_text());v={'status':r.get('status'),'startedAt':r.get('startedAt',''),'galleries':len(r.get('properties',[])),'totalGalleries':r.get('metrics',{}).get('qualifyingDiscovered',len(r.get('properties',[]))),'images':len(r.get('images',[])),'categorised':sum(bool(i.get('categorisation')) for i in r.get('images',[])),'sourceGaps':sum(e.get('stage')!='classification' for e in r.get('errors',[])),'name':r.get('builder',{}).get('name'),'modelsUsed':dict(Counter(i.get('analysisModel') or r.get('model','unknown') for i in r.get('images',[]) if i.get('verdict'))),'selectedModel':r.get('model'),'skippedGalleries':r.get('metrics',{}).get('skippedCompletedGalleries'),'sharedGalleries':r.get('metrics',{}).get('reusedGalleries',0),'skippedImages':r.get('metrics',{}).get('reusedImages',0)+r.get('metrics',{}).get('reusedImageSources',0),'skippedAnalyses':r.get('metrics',{}).get('skippedExistingAnalyses',0)+r.get('metrics',{}).get('analysisCacheHits',0),'_pendingIds':[i['id'] for i in r.get('images',[]) if not i.get('categorisation')]}
  v['developmentsFound']=r.get('metrics',{}).get('sitemapDevelopments',len(r.get('developments',[])))
  v['developmentsChecked']=len(r.get('developments',[]))
  v['houseTypesFound']=sum(d.get('homes',0) or 0 for d in r.get('developments',[]))
  try:direct=json.loads(direct_path.read_text()).get('images',{})
  except (OSError,ValueError):direct={}
  ai_ids={i['id'] for i in r.get('images',[]) if i.get('verdict') or (i.get('categorisation') and i['categorisation'].get('categorisationSource')!='website-html')}
  direct_ids={i['id'] for i in r.get('images',[]) if i['id'] in direct and i['id'] not in ai_ids}
  v['categorisedAI']=len(ai_ids);v['categorisedDirect']=len(direct_ids)
  v['categorised']=len(ai_ids|direct_ids)
  v['_pendingIds']=[i['id'] for i in r.get('images',[]) if i['id'] not in ai_ids and i.get('categorisation',{}).get('categorisationSource')!='website-html']
  v['_directIds']=list(direct_ids)
  CACHE[path]=(stamp,v);return v
 except (OSError,ValueError,TypeError):return CACHE.get(path,(None,None))[1]
def cached_analyses(ids):
 counts=Counter();found_ids=set()
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
    if valid:counts[model]+=1;found_ids.add(image_id);break
   except (OSError,ValueError,TypeError):pass
 return counts,found_ids
def latest_stats(folder):
 paths=[p for p in [folder/'results.json',folder/'checkpoint.json'] if p.exists()]
 return stats(max(paths,key=lambda p:p.stat().st_mtime_ns)) if paths else None
def read_session():
 try:return json.loads((ROOT/'results/.cache/progress-session.json').read_text())
 except (OSError,ValueError):return {}
def read_pipeline_state():
 try:return json.loads((ROOT/'results/.cache/builder-pipeline-state.json').read_text())
 except (OSError,ValueError):return {}
def data():
 with MUTEX:
  names=dict(re.findall(r"slug:\s*'([^']+)',\s*name:\s*'([^']+)'",(ROOT/'src/adapters/developers.ts').read_text()))
  try:requests=json.loads((ROOT/'docs/builder-crawl-requests.json').read_text()).get('builders',[])
  except (OSError,ValueError):requests=[]
  names.update({b['slug']:b['name'] for b in requests})
  order=[s for s in dict.fromkeys(QUEUE.read_text().splitlines()) if re.fullmatch(r'[a-z0-9-]+',s)]
  order=list(dict.fromkeys([*order,*names]))
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
  try:queue=json.loads((ROOT/'results/.cache/builder-recrawl-queue-state.json').read_text())
  except (OSError,ValueError):queue={}
  pipeline=read_pipeline_state()
  streams=pipeline.get('streams',{}) if pipeline.get('status')=='running' else {}
  active=streams.get('ai',{}).get('builder') or control.get('activeBuilder','')
  worker={}
  if re.fullmatch(r'[a-z0-9-]+',active):
   paths=[p for p in [ROOT/'results'/f'{active}-home-offices/gemini-state.json',ROOT/'results'/f'{active}-unrestricted-scan-20261003/gemini-state.json',ROOT/manifest.get(active,{}).get('folder','results/.cache')/'gemini-state.json'] if p.exists()]
   if paths:
    try:worker=json.loads(max(paths,key=lambda p:p.stat().st_mtime_ns).read_text())
    except (OSError,ValueError):pass
  if worker:quota=worker.get('state')=='quota_wait'
  try:html_sweep=json.loads((ROOT/'results/.cache/html-category-sweep.json').read_text())
  except (OSError,ValueError):html_sweep={}
  builders=[]
  for slug in order:
   state=manifest.get(slug,{})
   candidate=ROOT/'results'/f'{slug}-unrestricted-scan-20261003'
   canonical=ROOT/'results'/f'{slug}-home-offices'
   if pipeline.get('builders',{}).get(slug,{}).get('folder') and (ROOT/pipeline['builders'][slug]['folder']/'checkpoint.json').exists():candidate=ROOT/pipeline['builders'][slug]['folder']
   if state.get('folder') and str(state['folder']).startswith('results/') and (ROOT/state['folder']).is_dir():candidate=ROOT/state['folder']
   scan=latest_stats(candidate)
   canon=latest_stats(canonical)
   current=scan
   if not scan and canon and state.get('folder')==str(canonical.relative_to(ROOT)):current=canon
   if canon and ((scan and canon['startedAt']>=scan['startedAt']) or (slug=='bellway' and not state.get('htmlOnly') and canon['startedAt'].startswith('2026-10-03'))):current=canon
   if current:
    current=dict(current);current['modelsUsed']=dict(current.get('modelsUsed',{}));cached,cached_ids=(Counter(),set()) if state.get('htmlOnly') else cached_analyses(current.get('_pendingIds',[]));overlap=len(cached_ids & set(current.get('_directIds',[])));current['categorisedAI']+=len(cached_ids);current['categorisedDirect']-=overlap;current['categorised']+=len(cached_ids)-overlap;current['skippedAnalyses']+=sum(cached.values())
    for model,count in cached.items():current['modelsUsed'][model]=current['modelsUsed'].get(model,0)+count
   pushed=state.get('status')=='published' or (not state and f'{slug} published and pushed at ' in published_log)
   phase='Queued'
   if current:
    if current['status'] in ['running','classifying']:phase='Categorising' if current['status']=='classifying' else ('Reviewing' if pushed else 'Scanning')
    elif state.get('status') in ['failed','needs_review']:phase='Needs source review'
    elif state.get('status')=='categorising':phase='Categorising'
    elif current['images'] and current['categorised']==current['images'] and pushed:phase='Published'
    elif current['images']:phase='Collected · awaiting categorisation'
    else:phase='Needs source review'
   if current and (slug==active or streams.get('gallery',{}).get('builder')==slug) and current['status']=='running':current['eta']=crawl_eta(slug,current)
   stages=pipeline.get('builders',{}).get(slug,{})
   running_stage=next((stage for stage in ['ai','website','gallery'] if stages.get(stage,{}).get('status')=='running'),None)
   if running_stage:phase={'gallery':'Scanning','website':'Website categorisation','ai':'Categorising'}[running_stage]
   elif stages.get('ai',{}).get('status')=='complete':phase='Published'
   elif stages.get('website',{}).get('status')=='complete':phase='Collected · awaiting categorisation'
   elif stages.get('gallery',{}).get('status')=='complete':phase='Awaiting website categorisation'
   elif pipeline.get('status')=='running' and slug in ['bellway','cala','barratt']:phase='Queued for final review'
   if state.get('status')=='queued_html_only':phase='Queued · HTML only'
   if state.get('status')=='html_only_complete':phase='HTML checked · AI not requested'
   builders.append({'slug':slug,'name':(current or {}).get('name') or names.get(slug,slug),'phase':phase,'htmlCategories':html_sweep.get('builders',{}).get(slug,{'status':'unverified','compatible':False,'reason':'Website and gallery research pending'}),**({k:v for k,v in current.items() if k not in ['name','status'] and not k.startswith('_')} if current else {'galleries':0,'totalGalleries':0,'images':0,'categorised':0,'sourceGaps':0})})
  return {'htmlSweep':html_sweep,'session':read_session(), 'streams':streams,'updatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'quotaBlocked':quota,'pauseAfterCurrentBuilder':pause,'discoveryOnly':control.get('discoveryOnly',False),'activeBuilder':active,'queue':{'stage':queue.get('stage'),'nextBuilder':(queue.get('builders') or ['taylor-wimpey'])[queue.get('nextIndex',0)] if queue.get('nextIndex',0)<len(queue.get('builders') or ['taylor-wimpey']) else None},'gemini':{'state':({'quota_wait':'Waiting for quota · HTTP 429','analysing':'Analysing images','retrying':'Retrying request','complete':'Analysis worker finished'}.get(worker.get('state'),'No live worker status available')+(' · Retry scheduled: '+worker['retryAt'] if worker.get('retryAt') else '')) if worker else ('Waiting for quota · HTTP 429' if quota else 'No live worker status available'),'selectedModel':worker.get('model','gemini-3.1-flash-lite'),'fallbackModels':worker.get('fallbackModels',MODELS),'modelStates':worker.get('modelStates',[]),'retry':'Switch models immediately on quota; retry the pool every 2 minutes when all are exhausted','modelsUsed':dict(Counter({model:sum(b.get('modelsUsed',{}).get(model,0) for b in builders) for model in {m for b in builders for m in b.get('modelsUsed',{})}}))},'builders':builders,'summary':{'builders':len(builders),'collected':sum(b['phase'] in ['Collected · awaiting categorisation','Published','Categorising'] for b in builders),'published':sum(b['phase']=='Published' for b in builders),'images':sum(b['images'] for b in builders),'categorised':sum(b['categorised'] for b in builders),'categorisedDirect':sum(b.get('categorisedDirect',0) for b in builders),'categorisedAI':sum(b.get('categorisedAI',0) for b in builders)}}
HTML='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Builder scan progress</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f2eb;color:#15243a;font:15px/1.5 system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:32px 24px}header{display:flex;justify-content:space-between;gap:24px;align-items:center}h1{font:38px Georgia,serif;margin:8px 0}p{margin:8px 0}.muted{color:#657181;font-size:13px}.notice{background:#15243a;color:white;padding:16px 20px;margin:24px 0}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:24px 0}.stat{border-bottom:1px solid #d3d7d9;padding:16px 0}.stat strong{font:32px Georgia,serif;display:block}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.card{background:white;border:1px solid #d3d7d9;padding:20px}.card h2{font:22px Georgia,serif;margin:0 0 6px}.phase{font-size:12px;color:#52647b;margin:0 0 16px}.metrics{display:flex;justify-content:space-between;gap:12px;font-size:13px;margin:8px 0}.bar{height:5px;background:#eceef0;overflow:hidden}.bar span{display:block;height:100%;background:#15243a;transition:width .5s}.bar.categorisation span{background:#a7553e}.bar.direct-category span{background:#287e70}.gap{font-size:12px;color:#945532;margin-top:12px}.active{border-color:#a7553e}.summary span{font-size:12px;color:#657181}@media(max-width:650px){header{align-items:start;flex-direction:column;gap:4px}.grid{grid-template-columns:1fr}.summary{grid-template-columns:1fr 1fr}main{padding:20px}h1{font-size:32px}}.grid{align-items:start}.card{padding:0}.card>summary{position:relative;list-style:none;cursor:pointer;padding:18px 44px 18px 20px}.card>summary::-webkit-details-marker{display:none}.card>summary:after{content:'+';position:absolute;right:20px;top:18px;font-size:22px}.card[open]>summary:after{content:'−'}.card .phase{display:block;margin:4px 0 0}.card .current-process{margin:10px 0 0}.builder-details{padding:0 20px 20px;border-top:1px solid #eceef0}.gemini-details>summary{cursor:pointer;font-weight:600}.card>summary:focus-visible{outline:2px solid #a7553e;outline-offset:3px}.card>summary{min-height:180px;height:auto;display:flex;flex-direction:column;gap:6px}.card h2{white-space:normal;overflow-wrap:anywhere;flex-shrink:0}.card .phase{min-height:20px;height:auto;white-space:normal;overflow-wrap:anywhere;flex-shrink:0}.compact-metrics{margin-top:8px;display:grid;gap:8px;font-size:13px}.compact-metrics>div{display:flex;justify-content:space-between;gap:12px}.compact-metrics strong{white-space:nowrap}.summary{grid-template-columns:repeat(4,minmax(0,1fr))}.stat strong{font-size:27px}@media(max-width:650px){.summary{grid-template-columns:1fr 1fr}}</style>
<style>.html-badge{display:inline-block;padding:5px 9px;border-radius:20px;background:#e3efe6;color:#245b39;font-size:12px;font-weight:700}.html-badge[hidden]{display:none}.html-check{font-size:12px;color:#69717a}</style><main><header><div><p class="muted">UK SHOWHOME EXPLORER</p><h1>Growing your home collection</h1></div><p class="muted" id="updated">Connecting…</p></header><div class="notice" id="notice">Loading live progress…</div><p class="muted" id="html-sweep"></p><section class="summary" id="summary"></section><details class="notice gemini-details"><summary>Gemini worker details</summary><p id="gemini-state"></p><p id="gemini-models"></p><p id="gemini-fallbacks"></p><p>Direct categories use image labels from the source website. AI categories use Gemini visual analysis. Images with both are counted under AI only.</p></details><section class="grid" id="builders"></section><p class="muted">HTML Categories badges confirm complete room labels in a sampled live house-type gallery; styling tags may still need AI. NHBC builder order. Collection has no study, price or bedroom restrictions. Published collections are replaced only after categorisation and validation. Bellway, Cala and Barratt receive a final fresh review after the remaining builders.</p></main>
<script>
const fmt=n=>new Intl.NumberFormat('en-GB').format(n), nodes=new Map();
const metric=(label,value)=>{const el=document.createElement('div');el.className='stat';const v=document.createElement('strong');v.textContent=value;const l=document.createElement('span');l.textContent=label;el.append(v,l);return el};
function card(b,index,d){let el=nodes.get(b.slug);if(!el){el=document.createElement('details');el.className='card';el.innerHTML='<summary><h2></h2><span class="html-badge" hidden>HTML Categories</span><span class="phase"></span><div class="compact-metrics"><div><span>Developments found</span><strong class="compact-developments"></strong></div><div title="House types counted within each development"><span>House types found</span><strong class="compact-house-types"></strong></div><div><span>Galleries collected</span><strong class="compact-galleries"></strong></div><div><span>Images organised</span><strong class="compact-categorised"></strong></div></div></summary><div class="builder-details"><p class="html-check"></p><div class="metrics"><span>Developments checked</span><strong class="developments-checked"></strong></div><div class="metrics"><span>House types found</span><strong class="house-types-found"></strong></div><p class="eta muted" hidden></p><div class="metrics"><span>Galleries reached</span><strong class="galleries"></strong></div><div class="bar"><span class="collection-fill"></span></div><div class="metrics"><span>Distinct images collected</span><strong class="images"></strong></div><div class="metrics"><span>Images categorised</span><strong class="categorised"></strong></div><div class="bar total-category"><span class="total-fill"></span></div><div class="metrics"><span>Categorised direct</span><strong class="direct"></strong></div><div class="bar direct-category"><span class="direct-fill"></span></div><div class="metrics"><span>Categorised AI</span><strong class="ai"></strong></div><div class="bar categorisation"><span class="ai-fill"></span></div><div class="metrics"><span>Completed galleries skipped</span><strong class="skipped-galleries"></strong></div><div class="metrics"><span>Shared galleries skipped</span><strong class="shared-galleries"></strong></div><div class="metrics"><span>Duplicate images skipped</span><strong class="skipped-images"></strong></div><div class="metrics"><span>Gemini analyses reused</span><strong class="skipped-analyses"></strong></div><p class="gap"></p></div>';nodes.set(b.slug,el);document.getElementById('builders').append(el)}const stage=Object.entries(d.streams||{}).find(([stage,stream])=>stream.builder===b.slug&&stream.status==='running')?.[0];const active=Boolean(stage)||(b.slug===d.activeBuilder&&!['paused','finished','finished_with_source_gaps'].includes(d.queue.stage));el.classList.toggle('active',active);el.querySelector('.compact-developments').textContent=fmt(b.developmentsFound||0);el.querySelector('.compact-house-types').textContent=fmt(b.houseTypesFound||0);el.querySelector('.developments-checked').textContent=fmt(b.developmentsChecked||0)+' / '+fmt(b.developmentsFound||0);el.querySelector('.house-types-found').textContent=fmt(b.houseTypesFound||0);el.querySelector('.compact-galleries').textContent=b.totalGalleries?fmt(b.galleries)+' / '+fmt(b.totalGalleries):'Not started';el.querySelector('.compact-categorised').textContent=b.images?fmt(b.categorised)+' / '+fmt(b.images):'Not started';el.querySelector('h2').textContent=(index+1)+'. '+b.name;el.querySelector('.html-badge').hidden=!b.htmlCategories?.compatible;el.querySelector('.html-badge').title='Complete room labels in a sampled live house-type gallery';const check=b.htmlCategories||{};const samples=check.samples||[];const best=samples.filter(s=>s.images).sort((a,b)=>b.labelled/b.images-a.labelled/a.images)[0];el.querySelector('.html-check').textContent='HTML check: '+(check.status||'queued')+(best?' · '+best.labelled+' / '+best.images+' images labelled · '+best.conflicts+' ambiguous':'')+(check.reason?' · '+check.reason:'');el.dataset.htmlStatus=check.status||'queued';el.querySelector('.phase').title='HTML check: '+(b.htmlCategories?.status||'queued');el.querySelector('.phase').textContent=stage==='gallery'?'Finding home galleries':stage==='website'?'Organising labelled photos':stage==='ai'?(d.quotaBlocked?'Photo analysis will resume shortly':'Identifying remaining photos'):b.phase;const eta=el.querySelector('.eta');eta.hidden=!b.eta;if(b.eta){const e=b.eta;eta.textContent=e.state==='estimated'?'Crawl ETA: about '+Math.ceil(e.secondsRemaining/60)+' min remaining · '+new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'}).format(new Date(e.finishAt))+' London time · '+e.galleriesPerMinute+' galleries/min':e.state==='finishing'?'Crawl ETA: finishing final reports':e.state==='waiting'?'Crawl ETA: waiting for progress':'Crawl ETA: measuring recent speed…';}el.querySelector('.galleries').textContent=b.totalGalleries?fmt(b.galleries)+' / '+fmt(b.totalGalleries):'—';el.querySelector('.images').textContent=fmt(b.images);el.querySelector('.direct').textContent=fmt(b.categorisedDirect||0);el.querySelector('.ai').textContent=fmt(b.categorisedAI||0);el.querySelector('.categorised').textContent=b.images?fmt(b.categorised)+' / '+fmt(b.images):'—';el.querySelector('.collection-fill').style.width=(b.totalGalleries?Math.min(100,100*b.galleries/b.totalGalleries):0)+'%';el.querySelector('.total-fill').style.width=(b.images?Math.min(100,100*b.categorised/b.images):0)+'%';el.querySelector('.direct-fill').style.width=(b.images?Math.min(100,100*(b.categorisedDirect||0)/b.images):0)+'%';el.querySelector('.ai-fill').style.width=(b.images?Math.min(100,100*(b.categorisedAI||0)/b.images):0)+'%';el.querySelector('.skipped-galleries').textContent=b.skippedGalleries==null?'Not recorded':fmt(b.skippedGalleries);el.querySelector('.shared-galleries').textContent=fmt(b.sharedGalleries||0);el.querySelector('.skipped-images').textContent=fmt(b.skippedImages||0);el.querySelector('.skipped-analyses').textContent=fmt(b.skippedAnalyses||0);el.querySelector('.gap').textContent=b.sourceGaps?fmt(b.sourceGaps)+' source gap'+(b.sourceGaps===1?'':'s')+' recorded for review':'';}
async function refresh(){try{const response=await fetch('/api/progress',{cache:'no-store'});if(!response.ok)throw new Error();const d=await response.json();document.getElementById('updated').textContent='Updated '+new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(d.updatedAt))+' · refreshes every 10 seconds';const sweep=d.htmlSweep||{};const checked=Object.values(sweep.builders||{}).filter(b=>b.status!=='queued').length;document.getElementById('html-sweep').textContent='HTML gallery sweep: '+(sweep.status||'not started')+' · '+checked+' / '+Object.keys(sweep.builders||{}).length+' builders checked · '+Object.values(sweep.builders||{}).filter(b=>b.compatible).length+' confirmed. Main crawl is '+(d.pauseAfterCurrentBuilder?'paused.':'enabled.');const s=d.summary,baseline=d.session.summary||s;const sessionTotal=key=>d.session.builders?d.builders.reduce((sum,b)=>sum+Math.max(0,(b[key]||0)-(d.session.builders[b.slug]?.[key]||0)),0):Math.max(0,s[key]-baseline[key]);const gallery=d.streams?.gallery,ai=d.streams?.ai,website=d.streams?.website;const name=stream=>d.builders.find(b=>b.slug===stream?.builder)?.name;const activities=[];if(gallery?.status==='running')activities.push('Finding homes from '+name(gallery));if(website?.status==='running')activities.push('organising photos from '+name(website));if(ai?.status==='running')activities.push('identifying photos from '+name(ai));document.getElementById('notice').textContent=activities.length?activities.join(' · ')+'. Completed work is saved as we go.':d.pauseAfterCurrentBuilder?'Main crawl paused for HTML category checks.':'Preparing the next builders. Completed work is saved as we go.';const g=d.gemini;document.getElementById('gemini-fallbacks').textContent='Fallback pool: '+g.fallbackModels.join(' → ')+' · '+g.modelStates.map(m=>m.model+': '+m.status).join(', ');document.getElementById('gemini-state').textContent=g.state+' · '+g.retry;document.getElementById('gemini-models').textContent='Selected model: '+g.selectedModel+' · Models used: '+(Object.entries(g.modelsUsed).map(([m,n])=>m+' ('+fmt(n)+' images)').join(', ')||'No completed analyses');document.getElementById('summary').replaceChildren(metric('New photos this session',fmt(sessionTotal('images'))),metric('Photos organised this session',fmt(sessionTotal('categorised'))),metric('Builders published this session',fmt(Math.max(0,s.published-baseline.published))),metric('Photos organised overall',fmt(s.categorised)+' / '+fmt(s.images)));d.builders.forEach((b,index)=>card(b,index,d))}catch{document.getElementById('updated').textContent='Connection interrupted · retrying…'}}refresh();setInterval(refresh,10000);
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
