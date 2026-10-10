import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {createHash} from 'node:crypto';
import {createDatabase} from '../database/postgres';
import {developers} from '../adapters/developers';
import {classificationSnapshot} from './processing-snapshot';
import {homeTypeName} from '../reports/home-display';
import {developmentName} from '../web/development-name';
import {spaceName} from '../web/groups';
import {isGraphicAsset} from '../web/image-classification';
import {atomicFile} from '../crawler/atomic-file';
import {publishWebsite} from '../catalogue/publish';
import type {RunReport,ReportImage} from '../reports/report';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const stable=(v:any):string=>v&&typeof v==='object'?Array.isArray(v)?'['+v.map(stable).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v)??'null';
export const classificationUpgradeSQL=`update showhome_web.images i set metadata=i.metadata||jsonb_build_object('categorisation',v.metadata->'categorisation','analysisModel',v.metadata->'analysisModel')||case when v.metadata ? 'verdict' then jsonb_build_object('verdict',v.metadata->'verdict') else '{}'::jsonb end,main_category=v.main_category,is_room=v.is_room,eligible=v.eligible from jsonb_populate_recordset(null::showhome_web.images,$1::jsonb) v where i.builder_slug=v.builder_slug and i.catalogue_id=v.catalogue_id and (i.metadata->'categorisation' is null or i.metadata->'categorisation'='null'::jsonb) and jsonb_typeof(v.metadata->'categorisation')='object' returning i.key`;
async function main(){
 const {values}=parseArgs({options:{apply:{type:'boolean'},builder:{type:'string'},'skip-publication':{type:'boolean'}}});
 if(!values.apply)throw new Error('Use reconciliation-report.ts for a read-only preview; consolidation requires --apply.');
 const folder=resolve('.showhome/consolidation',new Date().toISOString().replace(/[:.]/g,'-'));await mkdir(folder,{recursive:true});
 const sql=createDatabase(),audit:any={startedAt:new Date().toISOString(),imageFilesUploaded:false,builders:[],publication:'pending'};
 try{
  const required=await sql.unsafe("select to_regclass('showhome_web.gallery_image_links') is not null as links, to_regclass('showhome_web.gallery_publication_summaries') is not null as summaries");
  if(!required[0]?.links||!required[0]?.summaries)throw new Error('Current schema lacks required normalized link or publication tables; no migrations will be applied automatically.');
  for(const builder of developers.filter(b=>!values.builder||b.slug===values.builder)){
   const report=await classificationSnapshot(builder.slug,`results/${builder.slug}-home-offices`);if(!report)continue;
   const entries:any[]=[],outboxFolder=resolve('.showhome/supabase-outbox',builder.slug),files=(await readdir(outboxFolder).catch(()=>[])).filter(f=>f.endsWith('.json'));
   for(let n=0;n<files.length;n+=128)await Promise.all(files.slice(n,n+128).map(async f=>{entries.push({file:resolve(outboxFolder,f),payload:JSON.parse(await readFile(resolve(outboxFolder,f),'utf8'))});}));
   const images=new Map(report.images.map(i=>[i.id,i]));for(const e of entries)if(e.payload.image?.categorisation)images.set(e.payload.image.id,e.payload.image);report.images=[...images.values()];
   console.log(`Consolidating ${builder.slug}: ${report.images.length} image records.`);
   const counts=await sql.begin(async tx=>{
    await tx`select pg_advisory_xact_lock(726391042)`;await tx`select pg_advisory_xact_lock(hashtext(${builder.slug}))`;
    const added={builder:builder.slug,newImages:0,newClassifications:0,newDevelopments:0,newBuildings:0,newGalleries:0,newLinks:0,conflicts:0,confirmedOutbox:0};
    await tx`insert into showhome_web.builders(slug,name,website_url) values(${builder.slug},${builder.name},${builder.website}) on conflict do nothing`;
    const devs=new Map(report.developments.map(d=>[d.url,d.name??d.url]));for(const home of report.properties)devs.set(home.developmentUrl,home.development);
    const developmentInserts=[...devs].map(([url,name])=>({key:hash(builder.slug+':'+url),builder_slug:builder.slug,source_url:url,name,display_name:developmentName(name)}));
    for(let n=0;n<developmentInserts.length;n+=500){const inserted=await tx.unsafe('insert into showhome_web.developments(key,builder_slug,source_url,name,display_name) select key,builder_slug,source_url,name,display_name from jsonb_populate_recordset(null::showhome_web.developments,$1::jsonb) on conflict do nothing returning key',[tx.json(developmentInserts.slice(n,n+500) as never)]);added.newDevelopments+=inserted.length;}
    const buildingInserts=[...new Set(report.properties.map(h=>homeTypeName(h.name).toLowerCase()))].map(name=>({key:hash(builder.slug+':'+name),builder_slug:builder.slug,name}));
    for(let n=0;n<buildingInserts.length;n+=500){const inserted=await tx.unsafe('insert into showhome_web.buildings(key,builder_slug,name) select key,builder_slug,name from jsonb_populate_recordset(null::showhome_web.buildings,$1::jsonb) on conflict do nothing returning key',[tx.json(buildingInserts.slice(n,n+500) as never)]);added.newBuildings+=inserted.length;}
    const rows=report.images.filter(i=>i.sourceUrl&&/^https?:\/\//.test(i.sourceUrl)).map(i=>({key:builder.slug+':'+i.id,builder_slug:builder.slug,catalogue_id:i.id,content_sha256:i.id,path:i.path,source_url:i.sourceUrl,main_category:spaceName(i,report.question),is_room:i.categorisation?.isRoom??Boolean(i.verdict?.matches),eligible:isGraphicAsset(i)?false:i.categorisation?Boolean(i.categorisation.isRoom||i.categorisation.mainCategory==='Exterior'):!i.verdict||i.verdict.matches,metadata:i}));
    for(let n=0;n<rows.length;n+=500){const batch=tx.json(rows.slice(n,n+500) as never);
     const inserted=await tx.unsafe('insert into showhome_web.images(key,builder_slug,catalogue_id,content_sha256,path,source_url,main_category,is_room,eligible,metadata) select key,builder_slug,catalogue_id,content_sha256,path,source_url,main_category,is_room,eligible,metadata from jsonb_populate_recordset(null::showhome_web.images,$1::jsonb) on conflict do nothing returning key',[batch]);added.newImages+=inserted.length;
     const changed=await tx.unsafe(classificationUpgradeSQL,[batch]);added.newClassifications+=changed.length;
    }
    const developmentRows=await tx`select key,source_url from showhome_web.developments where builder_slug=${builder.slug}`,buildingRows=await tx`select key,name from showhome_web.buildings where builder_slug=${builder.slug}`;
    const developmentKeys=new Map(developmentRows.map(d=>[d.source_url,d.key])),buildingKeys=new Map(buildingRows.map(b=>[b.name,b.key]));
    const existingGalleries=await tx`select key,source_url,development_key,building_key from showhome_web.galleries where builder_slug=${builder.slug}`;
    const galleryMap=new Map(existingGalleries.map(g=>[g.development_key+':'+g.building_key+':'+g.source_url,g.key]));const links:any[]=[],galleryInserts:any[]=[];
    for(const home of report.properties){const dk=developmentKeys.get(home.developmentUrl),bk=buildingKeys.get(homeTypeName(home.name).toLowerCase());if(!dk||!bk)throw new Error('Unresolved property identity');
     const identity=dk+':'+bk+':'+home.url;let gk=galleryMap.get(identity);
     if(!gk){gk=hash(builder.slug+':'+identity);galleryInserts.push({key:gk,builder_slug:builder.slug,development_key:dk,building_key:bk,name:home.name,source_url:home.url,bedrooms:home.bedrooms??null,price:home.price??null,plots:home.plots??[]});galleryMap.set(identity,gk);}
     [...new Set(home.imageIds)].forEach((id,position)=>links.push({gallery_key:gk,catalogue_id:id,position}));
    }
    for(let n=0;n<galleryInserts.length;n+=500){const inserted=await tx.unsafe('insert into showhome_web.galleries(key,builder_slug,development_key,building_key,name,source_url,bedrooms,price,plots) select key,builder_slug,development_key,building_key,name,source_url,bedrooms,price,plots from jsonb_populate_recordset(null::showhome_web.galleries,$1::jsonb) on conflict do nothing returning key',[tx.json(galleryInserts.slice(n,n+500) as never)]);added.newGalleries+=inserted.length;}
    for(let n=0;n<links.length;n+=1000){const inserted=await tx.unsafe(`insert into showhome_web.gallery_image_links(gallery_id,image_id,position) select g.internal_id,i.internal_id,v.position from jsonb_to_recordset($1::jsonb) v(gallery_key text,catalogue_id text,position integer) join showhome_web.galleries g on g.key=v.gallery_key join showhome_web.images i on i.builder_slug=$2 and i.catalogue_id=v.catalogue_id on conflict do nothing returning image_id`,[tx.json(links.slice(n,n+1000) as never),builder.slug]);added.newLinks+=inserted.length;}
    return added;
   });
   const confirmed=await sql`select catalogue_id,metadata->'categorisation' as categorisation from showhome_web.images where builder_slug=${builder.slug}`;
   const byId=new Map(confirmed.map(r=>[r.catalogue_id,r.categorisation]));
   for(const e of entries){const current=JSON.parse(await readFile(e.file,'utf8')),remote=byId.get(current.imageId);if(remote&&stable(remote)===stable(current.image?.categorisation)){current.status='synced';current.databaseConfirmed=true;current.databaseConfirmedAt=new Date().toISOString();await atomicFile(e.file,JSON.stringify(current,null,2));counts.confirmedOutbox++;}else if(remote){counts.conflicts++;}}
   audit.builders.push(counts);await atomicFile(resolve(folder,'audit.json'),JSON.stringify(audit,null,2));console.log(JSON.stringify(counts));
  }
  if(!values['skip-publication']){console.log('Refreshing website discovery projections from the merged database.');await publishWebsite(sql);audit.publication='completed';}
  audit.completedAt=new Date().toISOString();await atomicFile(resolve(folder,'audit.json'),JSON.stringify(audit,null,2));console.log('Consolidation audit: '+folder);
 }catch(error){audit.error=(error as {code?:string}).code??(error as Error).message;await atomicFile(resolve(folder,'audit.json'),JSON.stringify(audit,null,2));throw error;}finally{await sql.end({timeout:5});}
}
// Importable merge helper for regression tests without executing publication.
if(process.argv[1]?.replaceAll('\\','/').endsWith('/consolidate-local.ts'))main().catch(error=>{console.error('Consolidation stopped:',(error as {code?:string}).code??(error as Error).message);process.exitCode=1;});
