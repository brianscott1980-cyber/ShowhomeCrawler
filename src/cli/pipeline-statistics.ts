import {mkdir,readFile,open,unlink} from 'node:fs/promises';
import {createDatabase} from '../database/postgres';
import {progressStatistics,retainSamples,type ProgressSample} from '../reports/pipeline-statistics';
import type {PipelineSummary} from '../reports/pipeline-summary';
import {setTimeout as sleep} from 'node:timers/promises';
async function main(){
 await mkdir('.showhome/processing',{recursive:true});
 const file='.showhome/processing/statistics.lock';
 const old=await readFile(file,'utf8').then(Number).catch(()=>0);
 if(old){try{process.kill(old,0);return;}catch{await unlink(file).catch(()=>{});}}
 const lock=await open(file,'wx');await lock.writeFile(String(process.pid));
 const sql=createDatabase();let stopping=false;
 process.once('SIGINT',()=>{stopping=true;});process.once('SIGTERM',()=>{stopping=true;});
 try{while(!stopping){
  try{
   const rows=await sql`select key,payload from showhome_web.presentations where key like 'pipeline:crawl:%' or key like 'pipeline:classification:%' or key like 'pipeline:statistics:%'`;
   const histories=new Map(rows.filter(r=>r.key.startsWith('pipeline:statistics:')).map(r=>[r.key,r.payload]));
   for(const row of rows){if(row.key.startsWith('pipeline:statistics:'))continue;
    const summary=row.payload as PipelineSummary,key=`pipeline:statistics:${summary.phase}:${summary.builder}`,history=histories.get(key);
    if(history?.updatedAt===summary.updatedAt)continue;
    const samples=retainSamples((history?.samples??[]) as ProgressSample[],{at:new Date().toISOString(),completed:summary.totals.completed,images:summary.totals.images});
    const payload={updatedAt:summary.updatedAt,samples,statistics:progressStatistics(samples,summary)};
    await sql`insert into showhome_web.presentations(key,payload) values(${key},${sql.json(payload as never)}) on conflict(key) do update set payload=excluded.payload,updated_at=now()`;
   }
  }catch{console.error('Progress statistics unavailable; retrying.');}
  await sleep(30000);
 }}finally{await sql.end();await lock.close();await unlink(file);}
}
main().catch(()=>{console.error('Progress statistics could not start.');process.exitCode=1;});
