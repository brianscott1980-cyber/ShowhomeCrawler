import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';

const root=path.resolve(process.env.LOCAL_CONTENT_ROOT||'D:/ShowhomeCrawler');
const source=path.join(root,'backups/nas-import');
const auditRoot=path.join(root,'.showhome/storage-migration');
const progressPath=path.join(auditRoot,'progress.json');
const stats={status:'normalising',startedAt:new Date().toISOString(),files:0,images:0,newAssets:0,deduplicatedBytes:0,reports:0,classifications:0,existingClassifications:0,conflicts:0,errors:0};
const hash=async file=>{const h=createHash('sha256');for await(const chunk of createReadStream(file))h.update(chunk);return h.digest('hex');};
const json=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const atomic=async(file,value)=>{await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(value));await fs.rename(temp,file);};
const save=()=>atomic(progressPath,{...stats,updatedAt:new Date().toISOString()});
process.on('uncaughtException',async error=>{stats.status='failed';stats.error=error.message;await save();console.error(error.message);process.exit(1);});
const issue=async(value)=>{await fs.appendFile(path.join(auditRoot,'issues.jsonl'),JSON.stringify(value)+'\n');};
async function* walk(folder){const entries=await fs.readdir(folder,{withFileTypes:true});entries.sort((a,b)=>b.name.localeCompare(a.name));for(const entry of entries){const file=path.join(folder,entry.name);if(entry.isDirectory())yield* walk(file);else if(entry.isFile())yield file;}}
const aliases={};
async function linkMissing(from,to){await fs.mkdir(path.dirname(to),{recursive:true});try{await fs.link(from,to);return true;}catch(e){if(e.code!=='EEXIST')throw e;return false;}}
async function asset(file){
 const digest=await hash(file),ext=path.extname(file).toLowerCase(),name=digest+ext;
 if(path.relative(source,file).split(path.sep).join('/').startsWith('assets/')&&/^[a-f0-9]{64}\./.test(path.basename(file))&&path.basename(file).slice(0,64)!==digest)throw new Error('NAS asset filename checksum does not match copied bytes');
 const target=path.join(root,'assets',name);
 if(await linkMissing(file,target))stats.newAssets++;else {
  if(await hash(target)!==digest)throw new Error('Existing canonical asset hash mismatch: '+target);
  const [original,canonical]=await Promise.all([fs.stat(file),fs.stat(target)]);
  if(original.ino!==canonical.ino){
   const alias=file+'.'+randomUUID()+'.dedup.tmp';
   try{await fs.link(target,alias);await fs.rename(alias,file);stats.deduplicatedBytes+=original.size;}finally{await fs.unlink(alias).catch(()=>{});}
  }
 }
 const original=path.basename(file);
 if(aliases[original]&&aliases[original]!==name){stats.conflicts++;await issue({kind:'image_alias_conflict',alias:original,retained:aliases[original],variant:name});}else aliases[original]=name;
 const rel=path.relative(source,file).split(path.sep).join('/');if(rel.startsWith('archive/results/'))aliases[rel.slice('archive/'.length)]=name;
 await fs.appendFile(path.join(auditRoot,'verified-images.jsonl'),JSON.stringify({source:path.relative(source,file),sha256:digest,asset:name})+'\n');
 stats.images++;return target;
}
async function queue(builder,image,properties,origin){
 if(!image.categorisation||!/^[a-f0-9]{64}$/.test(image.id)||!/^[-a-z0-9]+$/.test(builder))return;
 const file=path.join(root,'.showhome/supabase-outbox',builder,image.id+'.json');
 const previous=await json(file).catch(()=>null);
 if(previous){stats.existingClassifications++;if(JSON.stringify(previous.image?.categorisation)!==JSON.stringify(image.categorisation)){stats.conflicts++;await issue({kind:'classification_variant',builder,imageId:image.id,retained:file,source:origin});}return;}
 await fs.mkdir(path.dirname(file),{recursive:true});
 const value={version:1,status:'pending',databaseConfirmed:false,builder,imageId:image.id,queuedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),image,properties,reason:'Imported workstation classification; database presence requires reconciliation.',importSource:origin};
 // Exclusive creation protects a classification written concurrently by a worker.
 const temp=file+'.'+randomUUID()+'.tmp';
 try{await fs.writeFile(temp,JSON.stringify(value),{flag:'wx'});await fs.link(temp,file);stats.classifications++;}catch(e){if(e.code!=='EEXIST')throw e;}finally{await fs.unlink(temp).catch(()=>{});}
}
function merge(current,incoming){
 if(!current)return incoming;
 const images=new Map(current.images.map(i=>[i.id,i]));
 for(const i of incoming.images){const old=images.get(i.id);if(!old)images.set(i.id,i);else if(!old.categorisation&&i.categorisation)images.set(i.id,{...i,...old,categorisation:i.categorisation,verdict:i.verdict,analysisModel:i.analysisModel});}
 const properties=new Map(current.properties.map(h=>[h.url,h]));
 for(const h of incoming.properties){const old=properties.get(h.url);properties.set(h.url,old?{...h,...old,imageIds:[...new Set([...old.imageIds,...h.imageIds])]}:h);}
 const developments=new Map(current.developments.map(d=>[d.url,d]));for(const d of incoming.developments)if(!developments.has(d.url))developments.set(d.url,d);
 return {...current,images:[...images.values()],properties:[...properties.values()],developments:[...developments.values()]};
}
async function report(file){
 const value=await json(file),builder=value.builder?.slug;
 if(!/^[-a-z0-9]+$/.test(builder)||!Array.isArray(value.images)||!Array.isArray(value.properties)||!Array.isArray(value.developments))return;
 const target=path.join(root,'.showhome/imported-reports',builder,'results.json');
 await atomic(target,merge(await json(target).catch(()=>null),value));stats.reports++;
 // Restore a missing crawl report, but never replace a live crawl's checkpoint.
 const crawlPath=path.join(root,'results',builder+'-home-offices','results.json');
 const checkpoint=path.join(path.dirname(crawlPath),'checkpoint.json');
 if(!await fs.access(checkpoint).then(()=>true,()=>false)){
  await fs.mkdir(path.dirname(crawlPath),{recursive:true});
  const temp=crawlPath+'.'+randomUUID()+'.tmp';
  try{await fs.writeFile(temp,JSON.stringify(value));await fs.link(temp,crawlPath);}catch(e){if(e.code!=='EEXIST')throw e;}finally{await fs.unlink(temp).catch(()=>{});}
 }
 for(const image of value.images)await queue(builder,image,value.properties.filter(h=>h.imageIds?.includes(image.id)),path.relative(source,file));
}

await fs.mkdir(auditRoot,{recursive:true});
if(process.argv.includes('--wait-copy')){
 await atomic(progressPath,{status:'copying',startedAt:new Date().toISOString(),copyLog:path.join(auditRoot,'copy.log')});
 while(true){
  const log=await fs.readFile(path.join(auditRoot,'copy.log'),'utf8').catch(()=>'');
  if(/Ended\s*:/.test(log)){
   const rows=[...log.matchAll(/^\s*(?:Files|Dirs)\s*:\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/gm)];
   if(rows.length<2||rows.some(row=>Number(row[5])>0))throw new Error('NAS copy incomplete: inspect copy.log before normalisation');
   break;
  }
  await atomic(progressPath,{status:'copying',startedAt:stats.startedAt,filesStarted:(log.match(/New File/g)||[]).length,current:log.trim().split(/\r?\n/).at(-1),copyLog:path.join(auditRoot,'copy.log'),updatedAt:new Date().toISOString()});
  await new Promise(r=>setTimeout(r,30_000));
 }
}
await save();
const reports=[];
for await(const file of walk(source)){
 stats.current=path.relative(source,file);stats.files++;
 try{
  const rel=path.relative(source,file).split(path.sep).join('/');
  if(/\.(jpg|jpeg|png|webp|avif|gif|tiff)$/i.test(file)||rel.startsWith('assets/')&&file.endsWith('.bin')){
   const target=await asset(file);
   if(rel.startsWith('archive/results/'))await linkMissing(target,path.join(root,rel.slice('archive/'.length)));
  }else if(rel.startsWith('archive/results/')&&!/(^|\/)(results|checkpoint)\.json$/.test(rel)){
   const target=path.join(root,rel.slice('archive/'.length));
   // Copy mutable metadata; hard links are reserved for immutable image bytes.
   await fs.mkdir(path.dirname(target),{recursive:true});
   try{await fs.copyFile(file,target,1);}catch(e){if(e.code!=='EEXIST')throw e;}
  }
  if(/(?:^|\/)(results|checkpoint)\.json$/.test(rel))reports.push(file);
  if(rel.startsWith('classification-backups/')&&file.endsWith('.json')){
   const batch=await json(file);for(const entry of batch.entries??[])await queue(entry.builder??batch.builder,entry.image,entry.properties??[],rel);
  }
 }catch(e){stats.errors++;await issue({kind:'import_error',source:stats.current,error:e.message});}
 if(stats.files%100===0)await save();
}
for(const file of reports){try{await report(file);}catch(e){stats.errors++;await issue({kind:'report_error',source:file,error:e.message});}await save();}
for(const name of ['image-index.json','raw-image-index.json']){
 const imported=await json(path.join(source,'archive/.showhome',name)).catch(()=>({}));
 const target=path.join(root,'.showhome',name),current=await json(target).catch(()=>({}));
 for(const [key,value]of Object.entries(imported))if(!current[key])current[key]=aliases[value]??value;
 if(name==='image-index.json')for(const [key,value]of Object.entries(aliases))if(!current[key])current[key]=value;
 await atomic(target,current);
}
stats.status=stats.errors?'completed_with_errors':'completed';stats.completedAt=new Date().toISOString();delete stats.current;await save();
console.log(JSON.stringify(stats));
