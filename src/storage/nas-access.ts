import {mkdir,open,readFile,readdir,stat,unlink,writeFile} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {sha256,imageIdentity} from '../galleries/image-hasher';
import {atomicFile} from '../crawler/atomic-file';
const root=resolve('.showhome/ssd-cache'),lockFile=resolve('.showhome/processing/nas-access.lock');
/** A single cross-process NAS operation at a time, with a small breathing interval. */
export async function nasAccess<T>(operation:()=>Promise<T>):Promise<T>{
 await mkdir(resolve('.showhome/processing'),{recursive:true});
 for(;;){
  let handle;
  try{handle=await open(lockFile,'wx');}
  catch(error){
   if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
   const owner=await readFile(lockFile,'utf8').then(Number).catch(()=>0);
   let dead=false;if(owner){try{process.kill(owner,0);}catch{dead=true;}}
   else dead=Date.now()-(await stat(lockFile).then(s=>s.mtimeMs).catch(()=>Date.now()))>30000;
   if(dead)await unlink(lockFile).catch(()=>{});
   await sleep(100+Math.random()*150);continue;
  }
  try{await handle.writeFile(String(process.pid));return await operation();}
  finally{await sleep(150);await handle.close();await unlink(lockFile).catch(()=>{});}
 }
}
export async function cacheImage(id:string,bytes:Buffer){
 if(!/^[a-f0-9]{64}$/.test(id)||sha256(bytes)!==id)throw new Error('Image hash does not match cache identifier');
 await mkdir(root,{recursive:true});await atomicFile(resolve(root,id+'.bin'),bytes);
 return bytes;
}
export async function cachedImage(id:string){
 const bytes=await readFile(resolve(root,id+'.bin'));if(sha256(bytes)!==id)throw new Error('SSD image cache hash mismatch');return bytes;
}
export async function nasImage(id:string,path:string){
 try{return await cachedImage(id);}catch{}
 if(path.startsWith('\\'))return cacheImage(id,await nasAccess(()=>readFile(path)));
 try{return await cacheImage(id,await readFile(path));}catch(error){
  if(!process.env.NAS_BACKUP_ROOT)throw error;
  const bytes=await cacheImage(id,await nasAccess(()=>readFile(resolve(process.env.NAS_BACKUP_ROOT!,'assets',basename(path)))));
  await mkdir(resolve(path,'..'),{recursive:true});await atomicFile(path,bytes);return bytes;
 }
}
export async function cachedIdentity(id:string,bytes:Buffer){
 try{const value=JSON.parse(await readFile(resolve(root,id+'.identity.json'),'utf8'));if(value.sha256===id&&typeof value.thumb==='string'&&typeof value.dhash==='string')return value as Awaited<ReturnType<typeof imageIdentity>>;}catch{}
 const value=await imageIdentity(bytes);if(value.sha256!==id)throw new Error('Image identity mismatch');await mkdir(root,{recursive:true});await atomicFile(resolve(root,id+'.identity.json'),JSON.stringify(value));return value;
}
export async function saveNasImage(id:string,path:string,bytes:Buffer){
 await cacheImage(id,bytes);
 const save=()=>writeFile(path,bytes,{flag:'wx'}).catch(error=>{if(error.code!=='EEXIST')throw error;});
 if(path.startsWith('\\'))await nasAccess(save);else await save();
}
/** Bound image storage to approximately 8 GiB; hash metadata stays available. */
export async function pruneImageCache(){
 const files=await readdir(root).catch(()=>[]),entries=[];
 for(const file of files.filter(f=>/^[a-f0-9]{64}\.bin$/.test(f))){const path=resolve(root,file),info=await stat(path).catch(()=>undefined);if(info)entries.push({path,size:info.size,stamp:info.mtimeMs});}
 let size=entries.reduce((sum,e)=>sum+e.size,0);
 for(const entry of entries.sort((a,b)=>a.stamp-b.stamp)){if(size<=8*1024**3)break;await unlink(entry.path).catch(()=>{});size-=entry.size;}
}
