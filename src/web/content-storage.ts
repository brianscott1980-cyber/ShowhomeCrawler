import {nasAccess,nasImage} from '../storage/nas-access';
import {readFile,stat} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
let indexStamp=0,index:Record<string,string>={};
let imageStamp=0,imageMap:Record<string,string>={};
async function imageIndex(){const file=resolve('.showhome/image-index.json');const stamp=await stat(file).then(s=>s.mtimeMs).catch(()=>0);if(stamp!==imageStamp){imageMap=stamp?JSON.parse(await readFile(file,'utf8')):{};imageStamp=stamp;}return imageMap;}
async function rawIndex(){
 const file=resolve('.showhome/raw-image-index.json');
 const stamp=await stat(file).then(s=>s.mtimeMs).catch(()=>0);
 if(stamp!==indexStamp){index=stamp?JSON.parse(await readFile(file,'utf8')):{};indexStamp=stamp;}
 return index;
}
async function nasRoot(){
 try{
  const status=JSON.parse(await readFile('.showhome/storage-status.json','utf8'));
  if(!status.nasAvailable||Date.now()/1000-status.checkedAt>90)return null;
  const config=JSON.parse(await readFile('.showhome/storage-config.json','utf8'));
  const marker=JSON.parse(await nasAccess(()=>readFile(resolve(status.contentRoot,'.showhome-storage.json'),'utf8')));
  return marker.id===config.identity?status.contentRoot as string:null;
 }catch{return null;}
}
function timed<T>(promise:Promise<T>):Promise<T>{return new Promise((accept,reject)=>{const timer=setTimeout(()=>reject(new Error('NAS unavailable')),3000);promise.then(value=>{clearTimeout(timer);accept(value)},error=>{clearTimeout(timer);reject(error)});});}
export async function storedFile(localPath:string,allowPreview=false):Promise<Buffer>{
 try{return await (localPath.startsWith('\\')?nasAccess(()=>readFile(localPath)):readFile(localPath))}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 const rel=relative(resolve(/* turbopackIgnore: true */ '.'),resolve(localPath)).split(sep).join('/');
 if(rel.startsWith('../'))throw new Error('Invalid content path');
 const raw=rel.match(/^results\/\.cache\/([a-f0-9]{64})\.bin$/);
 const image=rel.match(/(?:^|\/)images\/([a-f0-9]{64}\.(?:jpg|jpeg|png|webp|avif|gif|tiff))$/);
 const images=image?await imageIndex():{};
 const blob=raw?(await rawIndex())[raw[1]!]:image?(images[rel]??images[image[1]!]??image[1]):undefined;
 const root=await timed(nasRoot());
 if(root){try{return await timed(blob&&/^[a-f0-9]{64}\./.test(blob)?nasImage(blob.slice(0,64),resolve(root,'assets',blob)):nasAccess(()=>readFile(resolve(root,blob?'assets/'+blob:'archive/'+rel))))}catch{}}
 if(image&&allowPreview){try{return await readFile(resolve(/* turbopackIgnore: true */ '.showhome/previews',(blob??image[1]!).split('.')[0]+'.webp'))}catch{}}
 throw Object.assign(new Error(raw&&blob?'Image already downloaded; reconnect NAS to access it':'Content unavailable'),{code:'ENOENT',storedOnNas:Boolean(raw&&blob)});
}
export async function storedImage(id:string,extension:string,localPath?:string){
 const bytes=await storedFile(localPath??`results/storage/images/${id}.${extension}`,true);
 // Offline previews are always WebP, even when the original has a different format.
 const webp=bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
 return {bytes,extension:webp?'webp':extension};
}
