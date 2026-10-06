#!/usr/bin/env python3
"""Resumable verified NAS migration. Catalogue JSON and AI analyses stay local."""
import argparse,hashlib,json,os,re,signal,subprocess,time,uuid
from concurrent.futures import ThreadPoolExecutor
STOP=False
def stop(*_):
 global STOP
 STOP=True
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];LOCAL=ROOT/'.showhome'
def read(p,default=None):
 try:return json.loads(p.read_text())
 except (OSError,ValueError):return default

def save(p,value):
 p.parent.mkdir(parents=True,exist_ok=True);tmp=p.with_name(p.name+'.'+uuid.uuid4().hex+'.tmp');tmp.write_text(json.dumps(value,indent=2)+'\n');tmp.replace(p)
def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()
def verified_copy(source,target,checksum=None):
 checksum=checksum or digest(source);target.parent.mkdir(parents=True,exist_ok=True)
 if target.exists() and digest(target)==checksum:return checksum
 temp=target.with_name(target.name+'.'+uuid.uuid4().hex+'.partial')
 try:
  with source.open('rb') as src,temp.open('wb') as dst:
   for chunk in iter(lambda:src.read(1024*1024),b''):dst.write(chunk)
   dst.flush();os.fsync(dst.fileno())
  if digest(temp)!=checksum:raise RuntimeError('NAS checksum verification failed')
  temp.replace(target)
 finally:temp.unlink(missing_ok=True)
 return checksum

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--confirmed',action='store_true');parser.add_argument('--images-only',action='store_true');parser.add_argument('--workers',type=int,default=8);args=parser.parse_args()
 signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
 if not args.confirmed and not read(LOCAL/'storage-config.json',{}).get('migrationApproved',False):
  raise SystemExit('Migration has not been approved. No content was moved.')
 lock=LOCAL/'migration.lock'
 if lock.exists():
  pid=read(lock,{}).get('pid')
  try:os.kill(pid,0)
  except (ProcessLookupError,TypeError):lock.unlink()
  else:raise RuntimeError('Migration already running')
 save(lock,{'pid':os.getpid()})
 progress=read(LOCAL/'migration-progress.json',{'filesMoved':0,'bytesMoved':0,'imagesMoved':0});progress.pop('error',None);progress.update(status='running',pid=os.getpid(),scope='images' if args.images_only else 'all',phase='indexing',startedAt=time.time());save(LOCAL/'migration-progress.json',progress)
 try:
  status=read(LOCAL/'storage-status.json',{});config=read(LOCAL/'storage-config.json',{})
  nas=Path(status['contentRoot'])
  def health():
   if read(nas/'.showhome-storage.json',{}).get('id')!=config['identity']:raise RuntimeError('NAS disconnected or storage identity changed')
  health()
  # HTML is reproducible, but keep a verified archive for extraction and contact details.
  for source in ([] if args.images_only else (ROOT/'results/.cache/pages').glob('*.html')):
   health();size=source.stat().st_size;stamp=source.stat().st_mtime_ns
   verified_copy(source,nas/'archive'/source.relative_to(ROOT))
   if source.stat().st_mtime_ns!=stamp:continue
   source.unlink();progress['filesMoved']+=1;progress['bytesMoved']+=size
   if progress['filesMoved']%100==0:save(LOCAL/'migration-progress.json',progress);print(json.dumps(progress),flush=True)
  # Group hard links so all local aliases are removed together, actually reclaiming space.
  groups={}
  for base in [ROOT/'results',ROOT/'collections']:
   for folder in base.iterdir():
    images=folder/'images'
    if images.is_dir() and not (folder/'.lock').exists():
     for path in images.iterdir():
      if path.is_file() and re.fullmatch(r'[a-f0-9]{64}\.(jpg|jpeg|png|webp|avif|gif|tiff)',path.name):st=path.stat();groups.setdefault((st.st_dev,st.st_ino),[]).append(path)
  for path in (ROOT/'results/.cache').glob('*.bin'):
   st=path.stat();groups.setdefault((st.st_dev,st.st_ino),[]).append(path)
  progress.update(phase='copying_images',totalImageGroups=len(groups)+progress['imagesMoved'],totalImageBytes=sum(paths[0].stat().st_size for paths in groups.values())+progress['bytesMoved']);save(LOCAL/'migration-progress.json',progress)
  raw=read(LOCAL/'raw-image-index.json',{});image_index=read(LOCAL/'image-index.json',{});pending=[]
  def flush():
   if not pending:return
   health();previews=[]
   for paths,blob,size in pending:
    if any(p.parent.name=='images' for p in paths):
     target=LOCAL/'previews'/f'{blob.split(".")[0]}.webp'
     if not target.exists():previews.append({'source':str(paths[0]),'target':str(target)})
    for p in paths:
     if p.suffix=='.bin':raw[p.stem]=blob
     elif p.parent.name=='images':
      image_index[str(p.relative_to(ROOT))]=blob
      if p.name not in image_index or p.stem==blob.split('.')[0]:image_index[p.name]=blob
   if previews:
    previews=list({item['target']:item for item in previews}.values())
    batch=LOCAL/'preview-batch.json';save(batch,previews)
    subprocess.run(['node','scripts/storage-previews.mjs',str(batch)],cwd=ROOT,check=True)
   # Persist download knowledge before removing the local original.
   save(LOCAL/'raw-image-index.json',raw)
   save(LOCAL/'image-index.json',image_index)
   health()
   for paths,blob,size in pending:
    for p in paths:p.unlink(missing_ok=True);progress['filesMoved']+=1
    progress['bytesMoved']+=size;progress['imagesMoved']+=1
   save(LOCAL/'migration-progress.json',progress);print(json.dumps(progress),flush=True);pending.clear()
  def copy_group(paths):
   source=paths[0];size=source.stat().st_size
   image=next((p for p in paths if p.parent.name=='images'),None)
   sha=digest(source);blob=sha+(image.suffix if image else '.bin')
   verified_copy(source,nas/'assets'/blob,sha)
   return paths,blob,size,bool(image and image.stem!=sha)
  items=iter(groups.values())
  with ThreadPoolExecutor(max_workers=max(1,min(args.workers,16))) as workers:
   while not STOP:
    batch=[]
    for _ in range(50):
     paths=next(items,None)
     if paths is None:break
     batch.append(paths)
    if not batch:break
    health()
    for paths,blob,size,legacy in workers.map(copy_group,batch):
     if legacy:progress['legacyIdentifiers']=progress.get('legacyIdentifiers',0)+1
     pending.append((paths,blob,size))
    flush()
  if STOP:
   progress['status']='paused';save(LOCAL/'migration-progress.json',progress);return
  flush();progress['status']='complete';save(LOCAL/'migration-progress.json',progress)
  config['imagesMigrationComplete']=True
  if not args.images_only:config['migrationComplete']=True
  save(LOCAL/'storage-config.json',config)
 except Exception as error:
  progress.update(status='needs_attention',error=str(error));save(LOCAL/'migration-progress.json',progress);raise
 finally:lock.unlink(missing_ok=True)
if __name__=='__main__':main()
