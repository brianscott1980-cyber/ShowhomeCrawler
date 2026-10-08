import {classificationSnapshot} from './processing-snapshot';
import {requireLocalContentRoot} from './local-ai-config';
import {preparePublication,developmentPublication} from './classification-publication';
import {developers,readCollection,collectionFolder} from '../catalogue/files';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,rename,open,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
type Status='running'|'completed'|'completed_with_gaps'|'failed';
interface Job {classificationPid?:number;retryAt?:number;crawl?:Status;classification?:Status;folder:string;pid?:number;error?:string}
interface State {pid:number;startedAt:string;updatedAt:string;status:Status;builders:Record<string,Job>}
const root=resolve('.showhome/processing'),file=resolve(root,'state.json'),lockFile=resolve(root,'supervisor.lock');
const alive=(pid:number)=>{try{process.kill(pid,0);return true;}catch{return false;}};
let stopping=false;process.once('SIGINT',()=>{stopping=true;});process.once('SIGTERM',()=>{stopping=true;});
async function main(){
 await mkdir(resolve(root,'logs'),{recursive:true});
 const priorLock=await readFile(lockFile,'utf8').then(JSON.parse).catch(()=>null);
 if(priorLock&&alive(priorLock.pid))throw new Error('Processing is already running.');
 if(priorLock)await unlink(lockFile);
 const lock=await open(lockFile,'wx');await lock.writeFile(JSON.stringify({pid:process.pid}));
 const contentRoot=await requireLocalContentRoot();
 const tags=await fetch('http://127.0.0.1:11434/api/tags').then(r=>r.json());
 if(!tags.models.some((m:{name:string})=>m.name==='qwen3-vl:8b-instruct'))throw new Error('Install qwen3-vl:8b-instruct first.');
 await preparePublication();
 const previous:State|undefined=await readFile(file,'utf8').then(JSON.parse).catch(()=>undefined);
 const state:State={pid:process.pid,startedAt:previous?.startedAt??new Date().toISOString(),updatedAt:new Date().toISOString(),status:'running',builders:previous?.builders??{}};
 const order=(await readFile('docs/builder-recrawl-order.txt','utf8')).split(/\r?\n/).filter(slug=>developers.some(b=>b.slug===slug));
 for(const slug of order){const job=state.builders[slug]??={folder:`results/${slug}-home-offices`};if(job.classificationPid&&alive(job.classificationPid))throw new Error('An earlier classifier is still running.');if(job.pid&&alive(job.pid))throw new Error('An earlier worker is still running; avoid duplicate processing.');if(job.crawl==='running'||job.crawl==='failed'){job.crawl=undefined;await unlink(resolve(job.folder,'.lock')).catch(()=>{});}if(job.classification==='running'||job.classification==='failed')job.classification=undefined;}
 let saveQueue=Promise.resolve();
 const save=()=>{saveQueue=saveQueue.then(async()=>{state.updatedAt=new Date().toISOString();const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(state,null,2));await rename(temp,file);});return saveQueue;};
 async function run(slug:string,phase:string,args:string[]){
  const log=await open(resolve(root,'logs',`${phase}-${slug}.log`),'a');
  try{const child=spawn(process.execPath,['--import','tsx',...args],{cwd:process.cwd(),windowsHide:true,stdio:['ignore',log.fd,log.fd]});if(phase==='crawl')state.builders[slug]!.pid=child.pid;else state.builders[slug]!.classificationPid=child.pid;await save();console.log(`${phase}: ${slug} (PID ${child.pid})`);return await new Promise<number>((accept,reject)=>{child.once('error',reject);child.once('close',code=>accept(code??1));});}
  finally{if(phase==='crawl')delete state.builders[slug]!.pid;else delete state.builders[slug]!.classificationPid;await save();await log.close();}
 }
 let crawlingDone=false;
 async function crawl(){
  try{for(const slug of order){if(stopping)break;const job=state.builders[slug]!;if(job.crawl==='completed'||job.crawl==='completed_with_gaps')continue;job.crawl='running';await save();const checkpoint=await readFile(resolve(job.folder,'checkpoint.json'),'utf8').then(JSON.parse).catch(()=>null);
   const args=['src/cli/crawl.ts','--builder',slug,'--all-images','--discover-only','--preserve-existing','--refresh-pages','--output',job.folder,'--content-root',contentRoot,'--max-developments','1000','--max-properties','10000','--max-images','100000'];
   if(checkpoint&&['running','cancelled','failed'].includes(checkpoint.status))args.push('--resume');
   const code=await run(slug,'crawl',args);job.crawl=code?'failed':'completed';if(code)job.error='Crawl failed; see worker log.';await save();
  }}finally{crawlingDone=true;}
 }
 async function classify(){
  while(!stopping){
   let slug:string|undefined,report:Awaited<ReturnType<typeof classificationSnapshot>>;
   for(const candidate of order){const job=state.builders[candidate]!;if((job.retryAt??0)>Date.now())continue;const snapshot=await classificationSnapshot(candidate,job.folder);if(snapshot?.images.some(i=>!i.categorisation)){slug=candidate;report=snapshot;break;}}
   if(!slug||!report){await sleep(2000);continue;}
   const job=state.builders[slug]!;job.classification='running';await save();
   const sourceFolder=resolve(root,'classification-work',slug);await mkdir(sourceFolder,{recursive:true});await writeFile(resolve(sourceFolder,'results.json'),JSON.stringify(report));
   let code=1;
   for(let attempt=0;attempt<3;attempt++){
    code=await run(slug,'classification',['src/cli/classify-local.ts','--builder',slug,'--source-folder',sourceFolder,'--model','qwen3-vl:8b-instruct','--apply','--publish','--content-root',contentRoot]);
    const publication=await readFile('.showhome/classification-publication.json','utf8').then(JSON.parse).catch(()=>null);
    if(!code||publication?.slug===slug&&publication?.phase==='done')break;
    if(attempt<2)await sleep(30000);
   }
   const publication=await readFile('.showhome/classification-publication.json','utf8').then(JSON.parse).catch(()=>null);
   if(code&&(publication?.slug!==slug||publication?.phase!=='done')){job.classification='failed';job.error='Classification/publication will retry; see worker log.';job.retryAt=Date.now()+30000;await save();continue;}
   job.classification=code?'completed_with_gaps':'completed';job.retryAt=code?Date.now()+30000:0;await save();
  }
 }
 try{await save();const results=await Promise.allSettled([crawl().catch(error=>{stopping=true;throw error;}),classify().catch(error=>{stopping=true;throw error;})]);state.status=results.some(r=>r.status==='rejected')||Object.values(state.builders).some(j=>j.crawl==='failed'||j.classification==='failed')?'failed':stopping?'completed_with_gaps':'completed';await save();if(state.status==='failed')process.exitCode=1;}
 finally{await lock.close();await unlink(lockFile);}
}
main().catch(()=>{console.error('Local processing could not continue; inspect .showhome/processing logs and state.');process.exitCode=1;});
