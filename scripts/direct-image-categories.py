"""Extract image-specific room labels from cached HTML, without API requests.
Writes a sidecar so it never races with the running crawler's checkpoint.
"""
import argparse, hashlib, json, re, time
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

RULES = {
 'Bedroom': r'\b(?:bedroom|nursery)\b',
 'Bathroom': r'\b(?:bathroom|en[ -]?suite|shower room)\b',
 'Living Room': r'\b(?:living room|lounge|sitting room|family room|snug)\b',
 'Kitchen': r'\bkitchen\b',
 'Dining Room': r'\b(?:dining|diner)\b',
 'Study & Home Office': r'\b(?:study|home office)\b',
 'Utility Room': r'\b(?:utility|laundry room)\b',
 'Hallway': r'\b(?:hallway|landing|entrance hall)\b',
 'Toilet': r'\b(?:cloakroom|wc|powder room)\b',
 'Exterior': r'\b(?:exterior|garden|front elevation|rear elevation)\b',
 'Floorplan': r'\bfloor[ -]?plan\b',
}
def categories(text):
 return {name for name, pattern in RULES.items() if re.search(pattern, text, re.I)}
def source_key(url, page_url):
 from urllib.parse import urljoin, urlsplit
 u=urlsplit(urljoin(page_url,url))
 return u.netloc.lower()+u.path
class Labels(HTMLParser):
 def __init__(self,page_url):super().__init__();self.labels={};self.page_url=page_url
 def handle_starttag(self,tag,attrs):
  if tag not in ('img','image-gallery-image'):return
  a=dict(attrs);raw=a.get('url') or a.get('data-src') or a.get('src')
  if not raw:return
  for field in ('alt','title','caption','data-caption','aria-label'):
   text=a.get(field,'').strip()
   if text:self.labels.setdefault(source_key(raw,self.page_url),set()).add((field,text))
def extract(report, page_cache):
 evidence={}
 ai_ids={i['id'] for i in report.get('images',[]) if i.get('verdict') or i.get('categorisation')}
 for prop in report.get('properties',[]):
  url=prop['url'];path=Path('results/.cache/pages')/(hashlib.sha256(url.encode()).hexdigest()+'.html')
  if not path.exists():
   try:
    storage=json.loads(Path('.showhome/storage-status.json').read_text())
    if storage.get('nasAvailable'):path=Path(storage['contentRoot'])/'archive'/path
   except (OSError,ValueError,KeyError):pass
  if not path.exists():continue
  stamp=path.stat().st_mtime_ns
  if url not in page_cache or page_cache[url][0]!=stamp:
   parser=Labels(url);parser.feed(path.read_text());page_cache[url]=(stamp,parser.labels)
  for key,labels in page_cache[url][1].items():
   for field,text in labels:
    found=categories(text)
    if found:evidence.setdefault(key,[]).append({'pageUrl':url,'field':field,'text':text,'categories':sorted(found)})
 result={};conflicts=0
 for image in report.get('images',[]):
  if image['id'] in ai_ids:continue
  labels=evidence.get(source_key(image['sourceUrl'],report.get('builder',{}).get('websiteUrl','https://www.taylorwimpey.co.uk')),[])
  found=set().union(*(set(e['categories']) for e in labels)) if labels else set()
  if len(found)>1:conflicts+=1;continue
  if len(found)==1:result[image['id']]={'mainCategory':next(iter(found)),'source':'website-html','evidence':labels}
 return {'source':'website-html','images':result,'counts':dict(Counter(v['mainCategory'] for v in result.values())),'conflictingImages':conflicts}
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--folder',required=True);parser.add_argument('--watch',action='store_true');parser.add_argument('--apply',action='store_true');args=parser.parse_args()
 folder=Path(args.folder).resolve();root=Path('results').resolve()
 if not folder.is_relative_to(root):raise ValueError('Folder must be inside results')
 cache={}
 while True:
  report=json.loads((folder/'checkpoint.json').read_text());result=extract(report,cache)
  target=folder/'direct-categories.json';temporary=target.with_suffix('.json.tmp');temporary.write_text(json.dumps(result));temporary.replace(target)
  if args.apply:
   if args.watch or (folder/'.lock').exists() or (folder/'.analysis-stream.lock').exists():raise ValueError('Apply only after other workers have stopped')
   for image in report['images']:
    entry=result['images'].get(image['id'])
    if not entry:continue
    category=entry['mainCategory']
    image['categorisation']={'categorisationSource':'website-html','mainCategory':category,'subCategory':'','isRoom':category not in ['Exterior','Floorplan'],'objects':[],'colours':[],'chairs':[],'hasTelevision':False,'hasComputer':False}
    image['siteCategoryEvidence']=entry['evidence']
   report['metrics']['pendingImages']=sum(not i.get('categorisation') for i in report['images'])
   for name in ['checkpoint.json','results.json']:
    target=folder/name;temporary=target.with_suffix('.site.tmp');temporary.write_text(json.dumps(report));temporary.replace(target)
  print(json.dumps({'direct':len(result['images']),'images':len(report['images']),'conflicts':result['conflictingImages'],'crawlStatus':report['status']}),flush=True)
  if not args.watch or report['status'] not in ('running','classifying'):break
  time.sleep(30)
if __name__=='__main__':main()
