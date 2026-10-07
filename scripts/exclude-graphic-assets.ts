import {config} from 'dotenv';config({path:'.env.local',quiet:true});
import {isGraphicAsset} from '../src/web/image-classification';
const {websiteDatabase}=await import('../src/database/website');const sql=websiteDatabase();
const candidates=await sql`select internal_id,builder_slug,catalogue_id,path,metadata from showhome_web.images where metadata->'verdict' is not null`;
const rejected=candidates.filter(row=>isGraphicAsset(row.metadata));
const ids=new Set(rejected.map(row=>row.catalogue_id));const paths=new Set(rejected.flatMap(row=>[row.path,`/api/assets/${row.builder_slug}/${row.path}`]));
function clean(value:any):any{
 if(Array.isArray(value))return value.filter(item=>!(item&&typeof item==='object'&&(ids.has(item.id)||paths.has(item.src)||paths.has(item.path)))).map(clean);
 if(!value||typeof value!=='object')return value;
 const result=Object.fromEntries(Object.entries(value).map(([key,item])=>[key,key==='image'&&typeof item==='string'&&paths.has(item)?'':clean(item)]));
 if(Array.isArray(result.images)&&result.images.length&&(!result.image||paths.has(result.image)))result.image=result.images[0]?.src??'';
 return result;
}
console.log(`Excluding ${rejected.length} graphic assets`);
await sql.begin(async tx=>{
 for(let offset=0;offset<rejected.length;offset+=500){const batch=rejected.slice(offset,offset+500);await tx`update showhome_web.images set eligible=false where internal_id=any(${batch.map(row=>row.internal_id)}::bigint[])`;await tx`update showhome_web.gallery_card_index set eligible=false where uid=any(${batch.map(row=>`${row.builder_slug}:${row.catalogue_id}`)}::text[])`;}
 const cards=await tx`select kind,key,payload from showhome_web.directory_cards`;
 let changed=0;for(const row of cards){const payload=clean(row.payload);if(JSON.stringify(payload)!==JSON.stringify(row.payload)){await tx`update showhome_web.directory_cards set payload=${tx.json(payload)} where kind=${row.kind} and key=${row.key}`;changed++;}}
 const presentations=await tx`select key,payload from showhome_web.presentations`;
 for(const row of presentations){const payload=clean(row.payload);if(JSON.stringify(payload)!==JSON.stringify(row.payload))await tx`update showhome_web.presentations set payload=${tx.json(payload)},updated_at=now() where key=${row.key}`;}
 await tx`update showhome_web.publication_revision set revision=revision+1 where singleton=true`;await tx`delete from showhome_web.query_cache`;
 console.log(`Cleaned ${changed} directory previews and refreshed caches`);
});await sql.end();
