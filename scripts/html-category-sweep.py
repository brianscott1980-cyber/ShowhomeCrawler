"""Small, concurrent live gallery probes; never starts AI or changes collections."""
import concurrent.futures, datetime, hashlib, importlib.util, json, re, subprocess, threading
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('direct',ROOT/'scripts/direct-image-categories.py');direct=importlib.util.module_from_spec(spec);spec.loader.exec_module(direct)
TARGET=ROOT/'results/.cache/html-category-sweep.json'
LOCK=threading.Lock()
def evaluate(images, labels, page):
 evidence=[];covered=0;conflicts=0;types=set()
 for image in images:
  entries=labels.get(direct.source_key(image['sourceUrl'],page),set())
  found=set().union(*(direct.categories(text) for _,text in entries)) if entries else set()
  if len(found)==1:
   covered+=1;types.update(found)
   evidence.append({'imageUrl':image['sourceUrl'],'category':next(iter(found)),'labels':[{'field':field,'text':text} for field,text in sorted(entries) if direct.categories(text)]})
  elif len(found)>1:conflicts+=1
 return {'images':len(images),'labelled':covered,'conflicts':conflicts,'categories':sorted(types),'evidence':evidence,'compatible':len(images)>=3 and covered==len(images) and len(types)>=2}
class GalleryLabels(direct.Labels):
 def __init__(self,page):
  super().__init__(page);self.figures=[];self.caption_depth=0
 def handle_starttag(self,tag,attrs):
  a=dict(attrs);raw=a.get('url') or a.get('data-src') or a.get('src')
  if tag=='figure':self.figures.append({'images':[],'caption':[]})
  if tag=='figcaption' and self.figures:self.caption_depth+=1
  if tag in ('img','image-gallery-image') and raw:
   key=direct.source_key(raw,self.page_url);self.labels.setdefault(key,set())
   if self.figures:self.figures[-1]['images'].append(key)
  super().handle_starttag(tag,attrs)
 def handle_data(self,text):
  if self.caption_depth and self.figures:self.figures[-1]['caption'].append(text)
 def handle_endtag(self,tag):
  if tag=='figcaption':self.caption_depth=max(0,self.caption_depth-1)
  if tag=='figure' and self.figures:
   figure=self.figures.pop();caption=' '.join(' '.join(figure['caption']).split())
   # A caption for several images does not identify any one of them reliably.
   if caption and len(set(figure['images']))==1:self.labels[figure['images'][0]].add(('caption',caption))

def fetch(url):
 p=subprocess.run(['curl','--fail','--location','--silent','--show-error','--max-time','25','--max-filesize','10000000','-A','ShowhomeCrawler HTML category compatibility probe',url],capture_output=True)
 if p.returncode:raise ValueError('HTTP fetch failed: '+p.stderr.decode(errors='replace')[:180])
 return p.stdout

def probe(slug,name):
 reports=[]
 for base in ['results','collections']:
  for path in (ROOT/base).glob(slug+'*/results.json'):
   try:reports.append(json.loads(path.read_text()))
   except (ValueError,OSError):pass
 reports.sort(key=lambda r:r.get('startedAt',''),reverse=True)
 candidates={}
 for report in reports:
  byid={i['id']:i for i in report.get('images',[])}
  for prop in report.get('properties',[]):
   images=[byid[i] for i in prop.get('imageIds',[]) if i in byid]
   if images and prop['url']!=prop.get('developmentUrl'):candidates.setdefault(prop['url'],images)
 result={'slug':slug,'name':name,'status':'unverified','compatible':False,'samples':[]}
 for page,images in sorted(candidates.items(),key=lambda entry:-len(entry[1]))[:3]:
  try:
   html=fetch(page).decode(errors='replace');parser=GalleryLabels(page);parser.feed(html)
   # Only images still present in this live page count; stale galleries cannot earn a badge.
   present=[i for i in images if direct.source_key(i['sourceUrl'],page) in parser.labels]
   if not present:
    result['samples'].append({'pageUrl':page,'error':'No recognised gallery image labels in live HTML'});continue
   sample=evaluate(images,parser.labels,page);sample['pageUrl']=page;sample['liveImagesFound']=len(present)
   # Confirm actual image download rather than only inspecting page markup.
   image=fetch(present[0]['sourceUrl']);sample['downloadedImageBytes']=len(image)
   folder=ROOT/'results/.cache/html-category-probes'/slug;folder.mkdir(parents=True,exist_ok=True)
   (folder/(hashlib.sha256(page.encode()).hexdigest()+'.html')).write_text(html)
   (folder/'sample-image').write_bytes(image)
   result['samples'].append(sample)
   if sample['compatible']:
    result.update(compatible=True,status='compatible');break
  except Exception as error:result['samples'].append({'pageUrl':page,'error':str(error)})
 if not result['compatible']:
  result['status']='partial' if any(s.get('labelled') for s in result['samples']) else 'unlabelled' if any(s.get('images') for s in result['samples']) else 'unverified'
  if not candidates:result['reason']='No discovered house-type gallery available; requires website discovery'
 result['checkedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();return result

def main():
 names=dict(re.findall(r"slug:\s*'([^']+)',\s*name:\s*'([^']+)'",(ROOT/'src/adapters/developers.ts').read_text()))
 requests=ROOT/'docs/builder-crawl-requests.json'
 if requests.exists():names.update({b['slug']:b['name'] for b in json.loads(requests.read_text()).get('builders',[])})
 state={'status':'running','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Registered crawler builders with discovered house-type galleries; NHBC entries without websites/adapters remain unverified','builders':{s:{'slug':s,'name':n,'status':'queued','compatible':False} for s,n in names.items()}}
 def save():
  tmp=TARGET.with_suffix('.tmp');tmp.write_text(json.dumps(state,indent=2));tmp.replace(TARGET)
 save()
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
  pending={executor.submit(probe,s,n):s for s,n in names.items()}
  for future in concurrent.futures.as_completed(pending):
   result=future.result();state['builders'][result['slug']]=result;save();print(result['name']+': '+result['status'],flush=True)
 state['status']='complete';state['completedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();save()
if __name__=='__main__':main()
