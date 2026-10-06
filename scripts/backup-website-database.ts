import {mkdir,writeFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {createGzip} from 'node:zlib';
import {pipeline} from 'node:stream/promises';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {websiteDatabase} from '../src/database/website';
const {values}=parseArgs({options:{output:{type:'string'}}});
if(!values.output)throw Error('Pass --output <backup-folder>');
const folder=resolve(values.output);await mkdir(folder,{recursive:true});
const sql=websiteDatabase(),manifest:{table:string;rows:number;file:string}[]=[];
try{
 await sql.begin('isolation level repeatable read read only',async tx=>{
  const tables=await tx`select tablename from pg_tables where schemaname='showhome_web' order by tablename`;
  for(const {tablename} of tables){
   if(!/^[a-z_]+$/.test(tablename))throw Error('Unexpected table name');
   const file=tablename+'.ndjson.gz',zip=createGzip(),finished=pipeline(zip,createWriteStream(resolve(folder,file),{flags:'wx'}));let count=0;
   try{for await(const rows of tx.unsafe(`select to_jsonb(t) as row from showhome_web."${tablename}" t`).cursor(200)){for(const {row} of rows){if(!zip.write(JSON.stringify(row)+'\n'))await once(zip,'drain');count++;}}zip.end();await finished;}catch(error){zip.destroy();await finished.catch(()=>{});throw error;}
   manifest.push({table:tablename,rows:count,file});console.log(tablename,count);
  }
 });
 await writeFile(resolve(folder,'manifest.json'),JSON.stringify({created:new Date().toISOString(),schema:'showhome_web',tables:manifest},null,2));
 console.log('Backup completed:',folder);
}finally{await sql.end();}
