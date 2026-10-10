import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {ReportImage,RunReport} from './report';
/** Entries remain pending until a later uploader confirms a successful database write. */
export async function queueClassification(builder:string,image:ReportImage,report:RunReport){
 if(!image.categorisation)throw new Error('Cannot queue an unclassified image.');
 const folder=resolve('.showhome/supabase-outbox',builder);await mkdir(folder,{recursive:true});
 const file=resolve(folder,image.id+'.json');
 const previous=await readFile(file,'utf8').then(JSON.parse).catch(()=>undefined);
 const payload={version:1,status:'pending',databaseConfirmed:false,builder,imageId:image.id,
  queuedAt:previous?.queuedAt??new Date().toISOString(),updatedAt:new Date().toISOString(),
  image,properties:report.properties.filter(home=>home.imageIds.includes(image.id)),
  reason:'Local result awaiting Supabase reconciliation; database presence has not been verified.'};
 const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(payload,null,2));await rename(temp,file);
}
