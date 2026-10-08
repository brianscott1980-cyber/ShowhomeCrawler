import {mkdir,writeFile,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createDatabase} from '../database/postgres';
import {pipelineSummary,type PipelinePhase} from './pipeline-summary';
import type {RunReport} from './report';
/** Crawl and classification have separate files and database keys. */
export function progressReporter(phase:PipelinePhase){
 let sql:ReturnType<typeof createDatabase>|undefined,lastSent=0,lastStamp=0,warned=false;
 return {
  async update(builder:string,report:RunReport,force=false){
   const activity=phase==='crawl'?report.crawlProgress:report.classificationProgress;
   if(activity){lastStamp=Math.max(Date.now(),lastStamp+1);activity.updatedAt=new Date(lastStamp).toISOString();}
   const summary=pipelineSummary(builder,report,phase);
   await mkdir('.showhome/pipeline-progress',{recursive:true});
   const file=`.showhome/pipeline-progress/${phase}-${builder}.json`,temp=file+'.'+randomUUID()+'.tmp';
   await writeFile(temp,JSON.stringify(summary));await rename(temp,file);
   if(!process.env.DATABASE_URL||!force&&Date.now()-lastSent<15000)return;
   lastSent=Date.now();
   try{sql??=createDatabase();await sql`insert into showhome_web.presentations(key,payload) values(${`pipeline:${phase}:${builder}`},${sql.json(summary as never)}) on conflict(key) do update set payload=excluded.payload,updated_at=now() where coalesce(showhome_web.presentations.payload->>'updatedAt','')<=excluded.payload->>'updatedAt'`;}
   catch{if(!warned){console.warn(`${phase} progress saved locally; live progress unavailable. Check the database connection.`);warned=true;}}
  },
  async close(){await sql?.end();}
 };
}
