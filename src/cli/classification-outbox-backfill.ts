import {readFile,readdir,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {developers} from '../catalogue/files';
import {classificationSnapshot} from './processing-snapshot';
import {queueClassification} from '../reports/classification-outbox';
import type {RunReport} from '../reports/report';
const run=promisify(execFile);
async function main(){
 const cached=new Map<string,any>();
 for(const folder of await readdir('.showhome/local-ai',{withFileTypes:true})){
  if(!folder.isDirectory())continue;
  for(const file of await readdir(resolve('.showhome/local-ai',folder.name))){
   if(!/^[a-f0-9]{64}\.json$/.test(file))continue;
   const entry=JSON.parse(await readFile(resolve('.showhome/local-ai',folder.name,file),'utf8'));
   if(entry.model==='qwen3-vl:8b-instruct'&&entry.result?.categorisation)cached.set(entry.id,entry);
  }
 }
 let pending=0;const builders:Record<string,number>={};
 for(const builder of developers){
  const report=await classificationSnapshot(builder.slug,`results/${builder.slug}-home-offices`);if(!report)continue;
  let baseline:RunReport|undefined;
  try{baseline=JSON.parse((await run('git',['show',`HEAD:collections/${builder.slug}-home-offices/results.json`],{maxBuffer:50000000})).stdout);}catch{}
  const known=new Map(baseline?.images.map(image=>[image.id,image.categorisation]));
  for(const image of report.images){
   const entry=cached.get(image.id);
   if(!image.categorisation&&entry){image.categorisation=entry.result.categorisation;image.verdict=entry.result.verdict;image.analysisModel=entry.model;delete image.error;}
   if(!image.categorisation||JSON.stringify(known.get(image.id))===JSON.stringify(image.categorisation))continue;
   await queueClassification(builder.slug,image,report);pending++;builders[builder.slug]=(builders[builder.slug]??0)+1;
  }
  const folder=resolve('.showhome/processing/classification-work',builder.slug);await mkdir(folder,{recursive:true});
  const file=resolve(folder,'results.json'),temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(report));await rename(temp,file);
 }
 console.log(JSON.stringify({pending,builders,cachedImages:cached.size}));
}
main().catch(()=>{console.error('Outbox backfill failed; local classification data retained.');process.exitCode=1;});
