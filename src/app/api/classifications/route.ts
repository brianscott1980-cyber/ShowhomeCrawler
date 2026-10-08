import {websiteDatabase} from '../../../database/website';
import type {PipelineSummary} from '../../../reports/pipeline-summary';
import {createClient} from '@supabase/supabase-js';
import {publicAuthConfig} from '../../../auth/public-config';
import {classificationOwnerId} from '../../../auth/classification-owner';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store'};
 const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
 const config=publicAuthConfig(process.env);
 if(!token)return Response.json({error:'Sign in to view classifications.'},{status:401,headers});
 if(!config)return Response.json({error:'Authentication unavailable.'},{status:503,headers});
 const client=createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await client.auth.getUser(token);
 if(error||data.user?.id!==classificationOwnerId)return Response.json({error:'Access denied.'},{status:403,headers});
 const folder=resolve('pipeline-reports');
 const files=await readdir(folder).catch(()=>[]);
 const snapshots=await Promise.all(files.filter(f=>f.endsWith('.json')).map(async f=>JSON.parse(await readFile(resolve(folder,f),'utf8')) as PipelineSummary));
 const summaries=new Map(snapshots.map(s=>[s.phase+':'+s.builder,{...s,source:'snapshot'}]));
 let liveAvailable=false;
 try{
  const rows=await websiteDatabase()`select payload from showhome_web.presentations where key like 'pipeline:crawl:%' or key like 'pipeline:classification:%'`;
  for(const row of rows){const summary=row.payload as PipelineSummary;if(summary.phase==='crawl'||summary.phase==='classification')summaries.set(summary.phase+':'+summary.builder,{...summary,source:'live'});}
  liveAvailable=true;
 }catch{/* Committed summaries remain available when live progress cannot be read. */}
 return Response.json({commit:process.env.VERCEL_GIT_COMMIT_SHA??'local',liveAvailable,summaries:[...summaries.values()]}, {headers});
}
