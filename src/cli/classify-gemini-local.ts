import {cachedImage,cacheImage,nasImage} from '../storage/nas-access';
import {mkdir,readFile,open,unlink} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {atomicFile} from '../crawler/atomic-file';
import {setTimeout as sleep} from 'node:timers/promises';
import {readEnv} from '../config/env';
import {requireLocalContentRoot} from './local-ai-config';
import {classificationSnapshot} from './processing-snapshot';
import {classificationOrder,classificationBatches} from '../vision/classification-order';
import {classifyStructuredBatch} from '../vision/gemini-structured-batch';
import {GeminiModelPool,classificationModels} from '../vision/gemini-model-pool';
import {claimImage} from '../vision/image-claims';
import {queueClassification} from '../reports/classification-outbox';
import {developers} from '../catalogue/files';
import {geminiBuilderSelection} from '../vision/gemini-builder-selection';
async function main(){
 const root=resolve('.showhome/processing'),stateFile=resolve(root,'gemini-state.json'),lockFile=resolve(root,'gemini.lock');await mkdir(root,{recursive:true});
 const old=await readFile(lockFile,'utf8').then(Number).catch(()=>0);
 if(old){try{process.kill(old,0);return;}catch{await unlink(lockFile).catch(()=>{});}}
 const lock=await open(lockFile,'wx');await lock.writeFile(String(process.pid));
 const contentRoot=await requireLocalContentRoot(),env=readEnv();
 const pool=new GeminiModelPool(classificationModels(env.GEMINI_MODEL));
 const order=(await readFile('docs/builder-recrawl-order.txt','utf8')).split(/\r?\n/).filter(slug=>developers.some(b=>b.slug===slug));
 let stopped=false;process.once('SIGINT',()=>{stopped=true;});process.once('SIGTERM',()=>{stopped=true;});
 let retryAt=Date.parse((await readFile(stateFile,'utf8').then(JSON.parse).catch(()=>({}))).retryAt??'')||0,completed=0;
 let batchLimit=8,lastRequestAt=0,requests=0,failedRequests=0;
 const deferred=new Map<string,number>();
 async function save(file:string,payload:unknown){await atomicFile(file,JSON.stringify(payload,null,2));}
 const state=(status:string,extra:Record<string,unknown>={})=>save(stateFile,{pid:process.pid,status,updatedAt:new Date().toISOString(),completedThisRun:completed,requestsThisRun:requests,failedRequestsThisRun:failedRequests,batchLimit,...pool.snapshot(),...extra});
 try{while(!stopped){
  if(Date.now()<retryAt){await sleep(Math.min(30000,retryAt-Date.now()));continue;}
  if(!env.GEMINI_API_KEY){retryAt=Date.now()+900000;await state('waiting for API key',{retryAt:new Date(retryAt).toISOString()});console.log('Gemini API key unavailable; retry in 15 minutes.');await sleep(30000);continue;}
  const supervisor=await readFile(resolve(root,'state.json'),'utf8').then(JSON.parse).catch(()=>({builders:{}}));
  const queues=[];
  for(const slug of order){
   const report=await classificationSnapshot(slug,`results/${slug}-home-offices`);if(!report)continue;
   let ollamaActive=false;const pid=supervisor.builders?.[slug]?.classificationPid;
   if(pid){try{process.kill(pid,0);ollamaActive=true;}catch{}}
   queues.push({slug,report,ollamaActive,remaining:report.images.filter(i=>!i.categorisation).length});
  }
  const candidates=geminiBuilderSelection(queues);
  if(!candidates.length){
   const pending=queues.filter(q=>q.remaining>0);
   await state(pending.length===1?'waiting for Ollama':'waiting for images',pending.length===1?{builder:pending[0]!.slug,reason:'Final remaining builder assigned to Ollama'}:{});
   await sleep(2000);continue;
  }
  let found=false;
  for(const {slug,report} of candidates){
   if(stopped)break;
   // An existing Ollama process can predate shared claims; use another builder.
   const pid=supervisor.builders?.[slug]?.classificationPid;
   if(pid){try{process.kill(pid,0);continue;}catch{}}
   const pending=classificationOrder(report).images.filter(i=>!i.categorisation&&(deferred.get(i.id)??0)<=Date.now());
   const batch=classificationBatches(report,pending,batchLimit)[0];if(!batch?.length)continue;
   const releases:(()=>Promise<void>)[]=[],items:{id:string;bytes:Buffer}[]=[];
   try{
    for(const image of batch){
     const shared=await readFile(resolve('.showhome/supabase-outbox',slug,image.id+'.json'),'utf8').then(JSON.parse).catch(()=>undefined);
     if(shared?.image?.categorisation){Object.assign(image,shared.image);continue;}
     const release=await claimImage(image.id);if(!release)continue;releases.push(release);
     const paths=[resolve(contentRoot,'assets',basename(image.path)),resolve('results',slug+'-home-offices',image.path),resolve('collections',slug+'-home-offices',image.path),resolve('.showhome/local-ai/images',image.id+'.bin')];
     let bytes:Buffer|undefined;try{bytes=await cachedImage(image.id);}catch{} if(!bytes)for(const path of paths){try{bytes=await cacheImage(image.id,(path.startsWith('\\')||path===paths[0])?await nasImage(image.id,path):await readFile(path));break;}catch{}}
     if(bytes)items.push({id:image.id,bytes});
    }
    if(!items.length){const folder=resolve(root,'gemini-work',slug);await mkdir(folder,{recursive:true});await save(resolve(folder,'results.json'),report);continue;}
    found=true;const home=report.properties.find(p=>p.imageIds.includes(items[0]!.id));
    await state('running',{builder:slug,currentDevelopment:home?.development,batchSize:items.length});console.log(`Gemini: ${slug}, ${items.length} images, ${home?.development??'unlinked'}`);
    const result=await pool.run(async model=>{
     await sleep(Math.max(0,lastRequestAt+5000-Date.now()));lastRequestAt=Date.now();requests++;
     try{return await classifyStructuredBatch(items,env.GEMINI_API_KEY!,model);}catch(error){failedRequests++;throw error;}
    },()=>state('running',{builder:slug,model:pool.currentModel,batchSize:items.length}));
    for(const answer of result.value){const image=report.images.find(i=>i.id===answer.id)!;const classified={...image,...answer,analysisModel:result.model};delete classified.error;await queueClassification(slug,classified,report);Object.assign(image,classified);delete image.error;completed++;}
    const folder=resolve(root,'gemini-work',slug);await mkdir(folder,{recursive:true});await save(resolve(folder,'results.json'),report);
    await state('running',{builder:slug,model:result.model,currentDevelopment:home?.development});console.log(`Gemini saved ${result.value.length} classifications locally (${result.model}).`);
   }catch(error){
    const failure=error as {name?:string;status?:number;message?:string;retryAt?:string};
    const timeout=failure.name==='TimeoutError'||failure.name==='AbortError'||failure.status===408||failure.status===504;
    const invalid=failure.status===400||failure.name==='ZodError'||failure.name==='SyntaxError'||/Gemini batch|Incomplete Gemini/.test(failure.message??'');
    const detail=(failure.message??failure.name??'Unknown error').slice(0,600);
    if(invalid){
     if(batchLimit>1){batchLimit=Math.max(1,Math.floor(batchLimit/2));}
     else for(const item of items)deferred.set(item.id,Date.now()+900000);
     await state('retrying invalid response',{builder:slug,reason:failure.status===400?'request rejected':'invalid model output',httpStatus:failure.status,error:detail});
     console.log(`Gemini request/output rejected: ${detail}. Retrying with batch limit ${batchLimit}; single-image failures deferred for 15 minutes.`);
    }else{
     retryAt=failure.status===429?(Date.parse(failure.retryAt??'')||Date.now()+120000):Date.now()+900000;
     await state('paused',{builder:slug,reason:timeout?'timeout':failure.status===429?'quota exhausted':'Gemini or image source unavailable',error:detail,httpStatus:failure.status,retryAt:new Date(retryAt).toISOString()});
     console.log(`Gemini paused: ${detail}; retry at ${new Date(retryAt).toISOString()}.`);
    }
   }finally{for(const release of releases)await release();}
   if(found||retryAt>Date.now())break;
  }
  if(!found&&retryAt<=Date.now()){await state('waiting for images');await sleep(2000);}
 }}finally{await lock.close();await unlink(lockFile);}
}
main().catch(()=>{console.error('Local Gemini worker stopped; saved results retained.');process.exitCode=1;});
