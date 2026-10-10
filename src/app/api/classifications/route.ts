import {classificationSnapshot} from '../../../cli/processing-snapshot';
import {pipelineSummary} from '../../../reports/pipeline-summary';
import {localClassificationStatistics} from '../../../reports/local-classification-statistics';
import {progressStatistics,type ProgressSample} from '../../../reports/pipeline-statistics';
import {websiteDatabase} from '../../../database/website';
import type {PipelineSummary} from '../../../reports/pipeline-summary';
import {createClient} from '@supabase/supabase-js';
import {publicAuthConfig} from '../../../auth/public-config';
import {classificationOwnerId} from '../../../auth/classification-owner';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store'};
 const localAccess=process.env.NODE_ENV==='development'&&!process.env.VERCEL&&['localhost','127.0.0.1','[::1]'].includes(new URL(request.url).hostname);
 if(!localAccess){
 const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
 const config=publicAuthConfig(process.env);
 if(!token)return Response.json({error:'Sign in to view classifications.'},{status:401,headers});
 if(!config)return Response.json({error:'Authentication unavailable.'},{status:503,headers});
 const client=createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await client.auth.getUser(token);
 if(error||data.user?.id!==classificationOwnerId)return Response.json({error:'Access denied.'},{status:403,headers});
 }
 const folder=resolve('pipeline-reports');
 const files=await readdir(folder).catch(()=>[]);
 const snapshots=await Promise.all(files.filter(f=>f.endsWith('.json')).map(async f=>JSON.parse(await readFile(resolve(folder,f),'utf8')) as PipelineSummary));
 const summaries=new Map(snapshots.map(s=>[s.phase+':'+s.builder,{...s,source:'snapshot'}]));
 let liveAvailable=false;
 if(localAccess){
  const supervisor=await readFile(resolve('.showhome/processing/state.json'),'utf8').then(JSON.parse).catch(()=>({}));
  const gemini=await readFile(resolve('.showhome/processing/gemini-state.json'),'utf8').then(JSON.parse).catch(()=>({}));
  const alive=(pid:number|undefined)=>{if(!pid)return false;try{process.kill(pid,0);return true;}catch{return false;}};
  const localFolder=resolve('.showhome/pipeline-progress');
  const localFiles=await readdir(localFolder).catch(()=>[]);
  for(const file of localFiles.filter(f=>f.endsWith('.json'))){try{const summary=JSON.parse(await readFile(resolve(localFolder,file),'utf8')) as PipelineSummary;if(summary.phase==='crawl'||summary.phase==='classification')summaries.set(summary.phase+':'+summary.builder,{...summary,source:'local'});}catch{}}
  await Promise.all([...summaries.entries()].filter(([,summary])=>summary.phase==='classification').map(async([key,summary])=>{
   const report=await classificationSnapshot(summary.builder,`results/${summary.builder}-home-offices`);if(!report)return;
   const combined={...pipelineSummary(summary.builder,report,'classification'),status:summary.status,updatedAt:summary.updatedAt,currentDevelopments:summary.currentDevelopments,source:'local'};
   combined.statistics=localClassificationStatistics(report,combined);
   const workers:NonNullable<PipelineSummary['workers']>=[];
   if(alive(supervisor.builders?.[summary.builder]?.classificationPid)){
    const latestOllama=report.images.filter(i=>i.categorisation?.categorisationSource==='ollama').sort((a,b)=>Date.parse(b.categorisation?.classifiedAt??'')-Date.parse(a.categorisation?.classifiedAt??''))[0];
    const model=report.classificationProgress?.model??latestOllama?.categorisation?.categorisationModel??'Ollama';
    workers.push({id:'ollama',model,status:summary.status,updatedAt:summary.updatedAt,currentDevelopments:summary.currentDevelopments,statistics:localClassificationStatistics({...report,images:report.images.filter(i=>i.categorisation?.categorisationSource==='ollama')},combined)});
   }
   if(gemini.builder===summary.builder&&alive(gemini.pid)){
    const model=gemini.model??'Gemini';
    workers.push({id:'gemini',model,status:gemini.status,updatedAt:gemini.updatedAt,currentDevelopments:gemini.currentDevelopment?[gemini.currentDevelopment]:[],statistics:localClassificationStatistics({...report,images:report.images.filter(i=>i.categorisation?.categorisationSource==='gemini')},{...combined,status:gemini.status==='running'?'running':'stopped',updatedAt:gemini.updatedAt})});
   }
   Object.assign(combined,{workers});
   summaries.set(key,combined);
  }));
  return Response.json({commit:'local',liveAvailable:true,localMode:true,summaries:[...summaries.values()]},{headers});
 }
 try{
  const rows=await websiteDatabase()`select key,payload from showhome_web.presentations where key like 'pipeline:crawl:%' or key like 'pipeline:classification:%' or key like 'pipeline:statistics:%'`;
  for(const row of rows){const summary=row.payload as PipelineSummary;if(summary.phase==='crawl'||summary.phase==='classification')summaries.set(summary.phase+':'+summary.builder,{...summary,source:'live'});}
  for(const row of rows){if(!row.key?.startsWith('pipeline:statistics:'))continue;const key=row.key.replace('pipeline:statistics:',''),summary=summaries.get(key);if(summary)summary.statistics=progressStatistics((row.payload.samples??[]) as ProgressSample[],summary);}
  liveAvailable=true;
 }catch{/* Committed summaries remain available when live progress cannot be read. */}
 return Response.json({commit:process.env.VERCEL_GIT_COMMIT_SHA??'local',liveAvailable,summaries:[...summaries.values()]}, {headers});
}
