import {it,expect} from 'vitest';
import {readFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {queueClassification} from '../src/reports/classification-outbox';
import type {ReportImage,RunReport} from '../src/reports/report';
it('durably retains full results and links in an idempotent pending queue',async()=>{
 const builder='test-outbox-'+process.pid;
 const image={id:'sample',categorisation:{mainCategory:'Interior',categorisationModel:'local-model'}} as ReportImage;
 const report={properties:[{url:'home',imageIds:['sample']},{url:'other',imageIds:[]}]} as RunReport;
 const file=resolve('.showhome/supabase-outbox',builder,'sample.json');
 try{
  await queueClassification(builder,image,report);const first=JSON.parse(await readFile(file,'utf8'));
  await queueClassification(builder,image,report);const next=JSON.parse(await readFile(file,'utf8'));
  expect(next.status).toBe('pending');expect(next.databaseConfirmed).toBe(false);expect(next.queuedAt).toBe(first.queuedAt);
  expect(next.image.categorisation.categorisationModel).toBe('local-model');expect(next.properties.map((home:{url:string})=>home.url)).toEqual(['home']);
 }finally{await rm(resolve('.showhome/supabase-outbox',builder),{recursive:true,force:true});}
});
