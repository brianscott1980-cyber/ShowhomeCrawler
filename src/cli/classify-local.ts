import {preparePublication,developmentPublication} from './classification-publication.js';
import {requireLocalContentRoot} from './local-ai-config.js';
import {parseArgs} from 'node:util';
import {readFile,writeFile,mkdir,rename,open,unlink,access} from 'node:fs/promises';
import {resolve,basename,relative} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {developers,readCollection,collectionFolder} from '../catalogue/files.js';
import {storedFile} from '../web/content-storage.js';
import {classificationOrder} from '../vision/classification-order.js';
import {orderedBatchPool} from '../vision/ordered-batch-pool.js';
import {classifyLocal,localClassificationVersion,localSchema} from '../vision/local-classifier.js';
import type {ReportImage,RunReport} from '../reports/report.js';
const {values}=parseArgs({options:{publish:{type:'boolean'},sample:{type:'boolean'},model:{type:'string',default:process.env.LOCAL_AI_MODEL??'qwen3-vl:8b-instruct'},host:{type:'string',default:process.env.OLLAMA_HOST??'http://127.0.0.1:11434'},builder:{type:'string'},development:{type:'string'},'house-type':{type:'string'},limit:{type:'string'},concurrency:{type:'string',default:'1'},'content-root':{type:'string',default:process.env.LOCAL_CONTENT_ROOT},apply:{type:'boolean'},'include-classified':{type:'boolean'},'cache-dir':{type:'string',default:'.showhome/local-ai'}}});
const model=values.model!,host=values.host!,cacheRoot=resolve(values['cache-dir']!);
const limit=values.limit?Number(values.limit):values.sample?8:Infinity,concurrency=Number(values.concurrency);
if(!(limit>0)||!(Number.isInteger(concurrency)&&concurrency>=1&&concurrency<=8))throw new Error('Use a positive limit and concurrency between 1 and 8.');
if(values.apply&&concurrency!==1)throw new Error('Applied classification must run sequentially with concurrency 1.');
if(values.publish&&(!values.apply||values.sample||values['include-classified']||concurrency!==1))throw new Error('--publish requires --apply, concurrency 1, no --sample and no --include-classified.');
const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const profile=hash(model+':'+localClassificationVersion).slice(0,16),folder=resolve(cacheRoot,profile);
interface Entry {builder:string;id:string;category:string;referenceCategory?:string;elapsedMs:number;cached:boolean;error?:string}
const entries:Entry[]=[];
let stopping=false,total=0;
process.once('SIGINT',()=>{stopping=true;console.log('Stopping after active images finish; rerun to resume.');});
process.once('SIGTERM',()=>{stopping=true;});
async function atomic(file:string,value:unknown){const temporary=file+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(value,null,2));await rename(temporary,file);}
async function imageBytes(slug:string,sourceFolder:string,image:ReportImage){
 const download=resolve(cacheRoot,'images',image.id+'.bin');
 for(const path of [resolve(sourceFolder,image.path),resolve('collections',slug+'-home-offices',image.path),...(values['content-root']?[resolve(values['content-root'],'assets',basename(image.path)),resolve(values['content-root'],'archive',relative(process.cwd(),sourceFolder),image.path)]:[])])try{return await storedFile(path,true);}catch{}
 try{return await readFile(download);}catch{}
 const sources=[image.sourceUrl,`https://showhomeexplorer.vercel.app/api/assets/${slug}/${image.path}`].filter(Boolean);
 for(const url of sources)try{const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)continue;const bytes=Buffer.from(await response.arrayBuffer());await sharp(bytes).metadata();await mkdir(resolve(cacheRoot,'images'),{recursive:true});await writeFile(download,bytes);return bytes;}catch{}
 throw new Error('Image unavailable locally, on NAS, or from source; will retry on the next run.');
}
async function review(){
 await atomic(resolve(folder,'progress.json'),{model,version:localClassificationVersion,updatedAt:new Date().toISOString(),completed:entries.filter(entry=>!entry.error).length,failed:entries.filter(entry=>entry.error).length,total,entries});
 const cards=entries.map(entry=>`<article><img src="previews/${entry.builder}-${entry.id}.jpg" alt="Classification sample"><h2>${escape(entry.builder)} · ${escape(entry.category)}</h2><p>${escape(entry.elapsedMs/1000)} seconds${entry.cached?' · Cached':''} · Reference: ${escape(entry.referenceCategory??'Uncategorised')}</p><pre>${escape(entry.error??'')}</pre><div id="${entry.id}"></div></article>`).join('');
 const details=await Promise.all(entries.map(async entry=>{try{return [entry.id,JSON.parse(await readFile(resolve(folder,entry.id+'.json'),'utf8')).result.categorisation] as const;}catch{return [entry.id,null] as const;}}));
 const html=cards.replace(/<div id="([a-f0-9]+)"><\/div>/g,(_,id)=>`<pre>${escape(JSON.stringify(details.find(([key])=>key===id)?.[1],null,2))}</pre>`);
 await writeFile(resolve(folder,'report.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local image classification review</title><style>body{font:16px system-ui;background:#f4f1e9;color:#21352e;margin:30px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px}article{background:white;border:1px solid #ddd;border-radius:18px;padding:20px}img{width:100%;height:260px;object-fit:contain;background:#eee}h2{font-size:20px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}</style><h1>Local classification: ${escape(model)}</h1><p>${entries.filter(entry=>!entry.error).length} completed · ${entries.filter(entry=>entry.error).length} failed. Reference categories are earlier model classifications, not verified ground truth.</p><main>${html}</main></html>`);
}
async function main(){
 const publicationBranch=values.publish?await preparePublication():undefined;
 values['content-root']=await requireLocalContentRoot(values['content-root']);
 await mkdir(resolve(folder,'previews'),{recursive:true});
 const tags=await fetch(host.replace(/\/$/,'')+'/api/tags',{signal:AbortSignal.timeout(5000)}).catch(()=>null);
 if(!tags?.ok)throw new Error('Ollama is unavailable; run npm run ai:local:setup first.');
 const samples=values.sample?JSON.parse(await readFile('test/fixtures/local-classification/sample.json','utf8')) as {builder:string;id:string;scenario:string}[]:null;
 const selected=developers.filter(builder=>(!values.builder||builder.slug===values.builder)&&(!samples||samples.some(sample=>sample.builder===builder.slug))).sort((a,b)=>a.name.localeCompare(b.name));
 if(!selected.length)throw new Error('No matching builder. Use the builder slug, e.g. bellway.');
 for(const builder of selected){
  if(stopping||entries.length>=limit)break;
  const report=await readCollection(builder.slug);if(!report)continue;
  const sourceFolder=collectionFolder(builder.slug);
  const propertyIds=values.development||values['house-type']?new Set(report.properties.filter(home=>(!values.development||home.development.toLowerCase().includes(values.development.toLowerCase()))&&(!values['house-type']||home.name.toLowerCase().includes(values['house-type'].toLowerCase()))).flatMap(home=>home.imageIds)):null;
  const pending=classificationOrder(report).images.filter(image=>(!samples||samples.some(sample=>sample.builder===builder.slug&&sample.id===image.id))&&(!propertyIds||propertyIds.has(image.id))&&(samples||values['include-classified']||!image.categorisation)).slice(0,limit-entries.length);
  total+=pending.length;if(!pending.length)continue;
  let lock:Awaited<ReturnType<typeof open>>|undefined;
  if(values.apply){
   if(await access(sourceFolder+'/.analysis-stream.lock').then(()=>true,()=>false))throw new Error('A streaming classifier is using this builder. Stop it before applying local results.');
   lock=await open(sourceFolder+'/.lock','wx');
  }
  console.log(`${builder.name}: ${pending.length} images; ${concurrency} local request(s) in flight`);
  try{
   const order=classificationOrder(report);
   const developments:typeof pending[]=[];let previous='';
   for(const image of pending){const group=order.group(image);const development=group==='unlinked'?'unlinked':JSON.parse(group)[0];if(development!==previous||!developments.length)developments.push([]);developments.at(-1)!.push(image);previous=development;}
   for(const developmentImages of developments){
   await orderedBatchPool(developmentImages,concurrency,async image=>{
    const file=resolve(folder,image.id+'.json');let result:Awaited<ReturnType<typeof classifyLocal>>|undefined,cached=false;
    try{
     try{const saved=JSON.parse(await readFile(file,'utf8'));if(saved.model===model&&saved.version===localClassificationVersion){localSchema.parse({...saved.result.categorisation,description:saved.result.verdict.description});result=saved.result;cached=true;}}catch{}
     if(!result){console.log(`Classifying ${builder.slug}:${image.id.slice(0,12)}`);const bytes=await imageBytes(builder.slug,sourceFolder,image);await sharp(bytes).rotate().resize({width:600,withoutEnlargement:true}).jpeg({quality:75}).toFile(resolve(folder,'previews',builder.slug+'-'+image.id+'.jpg'));result=await classifyLocal(bytes,{model,host});await atomic(file,{model,version:localClassificationVersion,id:image.id,result});}
     const preview=resolve(folder,'previews',builder.slug+'-'+image.id+'.jpg');
     if(cached&&!await access(preview).then(()=>true,()=>false)){const bytes=await imageBytes(builder.slug,sourceFolder,image);await sharp(bytes).rotate().resize({width:600,withoutEnlargement:true}).jpeg({quality:75}).toFile(preview);}
     entries.push({builder:builder.slug,id:image.id,category:result.categorisation.mainCategory,referenceCategory:image.categorisation?.mainCategory,elapsedMs:result.elapsedMs,cached});
     if(values.apply){image.categorisation=result.categorisation;image.verdict=result.verdict;image.analysisModel=model;delete image.error;}
     console.log(`${entries.length}: ${builder.name} · ${result.categorisation.mainCategory} · ${cached?'cached':(result.elapsedMs/1000).toFixed(1)+'s'}`);
    }catch(error){const message=error instanceof Error&&error.message.startsWith('Local model')?error.message:'Local image classification failed; see source availability or Ollama logs and rerun.';if(values.apply)image.error=message;entries.push({builder:builder.slug,id:image.id,category:'Failed',elapsedMs:0,cached:false,error:message});console.log(`${builder.name}: ${message}`);}
   },()=>stopping);
   if(values.apply){await atomic(sourceFolder+'/results.json',report);await atomic(sourceFolder+'/checkpoint.json',report);}
   if(publicationBranch&&!stopping){const group=order.group(developmentImages[0]!);const url=group==='unlinked'?'unlinked':JSON.parse(group)[0];const name=report.properties.find(h=>h.developmentUrl===url)?.development??url;await developmentPublication(builder.slug,sourceFolder,name,report,publicationBranch);}
   await review();if(stopping)break;
   }
  }finally{if(lock){await lock.close();await unlink(sourceFolder+'/.lock');}await review();}
 }
 await review();console.log(`Review: ${resolve(folder,'report.html')}`);
 if(entries.some(entry=>entry.error))process.exitCode=1;
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Local classification failed.');process.exitCode=1;});
