import {mkdir,readdir,readFile,stat,open,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
import {requireLocalContentRoot} from './local-ai-config';
import {nasAccess,pruneImageCache} from '../storage/nas-access';
import {atomicFile} from '../crawler/atomic-file';
async function main(){
 const root=resolve('.showhome/processing'),lockPath=resolve(root,'nas-result-sync.lock');await mkdir(root,{recursive:true});
 const prior=await readFile(lockPath,'utf8').then(Number).catch(()=>0);
 if(prior){try{process.kill(prior,0);return;}catch{await unlink(lockPath).catch(()=>{});}}
 const lock=await open(lockPath,'wx');await lock.writeFile(String(process.pid));
 const contentRoot=process.env.NAS_BACKUP_ROOT??await requireLocalContentRoot(),stateFile=resolve(root,'nas-result-sync.json');
 const copied:Record<string,number>=await readFile(stateFile,'utf8').then(JSON.parse).then(s=>s.copied??{}).catch(()=>({}));
 let stopped=false;process.once('SIGTERM',()=>{stopped=true;});process.once('SIGINT',()=>{stopped=true;});
 try{while(!stopped){
  try{
   await pruneImageCache();
   const outbox=resolve('.showhome/supabase-outbox');
   for(const builder of await readdir(outbox)){
    if(stopped)break;
    const folder=resolve(outbox,builder);if(!(await stat(folder)).isDirectory())continue;
    let batch:{key:string;stamp:number;payload:unknown}[]=[];
    async function flush(){
     if(!batch.length)return;
     const destination=resolve(contentRoot,'classification-backups',builder);
     const name=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID()+'.json';
     await nasAccess(async()=>{await mkdir(destination,{recursive:true});await atomicFile(resolve(destination,name),JSON.stringify({version:1,builder,createdAt:new Date().toISOString(),entries:batch.map(item=>item.payload)}));});
     for(const item of batch)copied[item.key]=item.stamp;
     await atomicFile(stateFile,JSON.stringify({pid:process.pid,status:'running',updatedAt:new Date().toISOString(),copied}));
     console.log(`NAS backup: ${builder}, ${batch.length} local classification results copied.`);batch=[];
    }
    for(const file of await readdir(folder)){
     if(stopped)break;if(!file.endsWith('.json'))continue;
     const path=resolve(folder,file),stamp=(await stat(path)).mtimeMs,key=builder+'/'+file;
     if(copied[key]===stamp)continue;
     batch.push({key,stamp,payload:JSON.parse(await readFile(path,'utf8'))});if(batch.length>=500)await flush();
    }
    await flush();
   }
  }catch(error){console.error('NAS result backup will retry:',(error as Error).message);}
  for(let elapsed=0;elapsed<300000&&!stopped;elapsed+=1000)await sleep(1000);
 }}finally{await lock.close();await unlink(lockPath).catch(()=>{});}
}
main().catch(error=>{console.error((error as Error).message);process.exitCode=1;});
