import {isGraphicAsset} from '../web/image-classification';
import type postgres from 'postgres';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {developers,readCollection,collectionFolder} from './files';
import {readLocationRows} from './location-files';
import {builderFacts} from './fact-files';
import {readDevelopmentContact} from './contact-files';
import logos from '../../public/logos/sources.json';
import offices from '../data/builder-google-reviews.json';
import {builderBrand} from '../web/builder-brand';
import {developmentName} from '../web/development-name';
import {homeTypeName} from '../reports/home-display';
import {spaceName} from '../web/groups';
import type {RunReport} from '../reports/report';

export const catalogueKey=(value:string)=>createHash('sha256').update(value).digest('hex');
async function fileJson<T>(path:string,fallback:T):Promise<T>{return readFile(path,'utf8').then(s=>JSON.parse(s) as T).catch(()=>fallback);}
async function insert(sql:postgres.TransactionSql,table:string,rows:Record<string,unknown>[]){
 if(!rows.length)return;
 const columns=Object.keys(rows[0]!);const fields=columns.map(column=>`"${column}"`).join(',');
 for(let offset=0;offset<rows.length;offset+=500)await sql.unsafe(`insert into showhome_web.${table} (${fields}) select ${fields} from jsonb_populate_recordset(null::showhome_web.${table},$1::jsonb)`,[sql.json(rows.slice(offset,offset+500) as never)]);
}
export async function importBuilder(sql:postgres.Sql,slug:string){
 const developer=developers.find(d=>d.slug===slug);if(!developer)throw new Error('Unknown builder');
 const report=await readCollection(slug);if(!report)return null;
 const folder=collectionFolder(slug);
 const [locations,details,index]=await Promise.all([readLocationRows(slug),fileJson<{url:string;scope?:string;properties:{bedrooms:number|null;price:number|null;style:string|null}[]}[]>(`${folder}/site-details.json`,[]),fileJson<Record<string,string>>('.showhome/image-index.json',{})]);
 const place=new Map(locations.map(row=>[row.url,row]));
 const devs=new Map(report.developments.map(d=>[d.url,d]));
 for(const home of report.properties)if(!devs.has(home.developmentUrl))devs.set(home.developmentUrl,{url:home.developmentUrl,name:home.development,status:'complete'});
 for(const row of locations)if(!devs.has(row.url))devs.set(row.url,{url:row.url,name:row.name,status:'discovered'});
 const developmentRows:{key:string;builder_slug:string;source_url:string;name:string;display_name:string;town:string|null;country:string|null;postcode:string|null;latitude:number|null;longitude:number|null;geography:Record<string,string|null>;areas:string[];contact:unknown;crawl_metadata:unknown;property_scope:string|null}[]=[];
 for(const d of devs.values()){
  const location=place.get(d.url),detail=details.find(item=>item.url===d.url);
  developmentRows.push({key:catalogueKey(`${slug}:${d.url}`),builder_slug:slug,source_url:d.url,name:d.name??location?.name??d.url,display_name:developmentName(d.name??location?.name??d.url),town:location?.town??d.town??null,country:location?.country??d.country??null,postcode:location?.postcode??null,latitude:location?.latitude??null,longitude:location?.longitude??null,geography:location?.geography??{},areas:Object.values(location?.geography??{}).filter((v):v is string=>Boolean(v&&typeof v==='string')),contact:await readDevelopmentContact(d.url),crawl_metadata:d,property_scope:detail?.scope??null});
 }
 const buildings=[...new Set(report.properties.map(home=>homeTypeName(home.name).toLowerCase()))].map(name=>({key:catalogueKey(`${slug}:${name}`),builder_slug:slug,name}));
 const images=report.images.map(image=>({key:`${slug}:${image.id}`,builder_slug:slug,catalogue_id:image.id,content_sha256:(index[`${folder}/${image.path}`]??index[image.path.split('/').at(-1)!]??image.id).split('.')[0],path:image.path,source_url:image.sourceUrl,main_category:spaceName(image,report.question),is_room:image.categorisation?.isRoom??Boolean(image.verdict?.matches),eligible:isGraphicAsset(image)?false:image.categorisation?image.categorisation.isRoom||image.categorisation.mainCategory==='Exterior':!image.verdict||image.verdict.matches,metadata:image}));
 const knownImages=new Set(images.map(i=>i.key));
 const galleries=report.properties.map((home,position)=>({key:catalogueKey(`${slug}:${home.developmentUrl}:${home.url}:${position}`),builder_slug:slug,development_key:catalogueKey(`${slug}:${home.developmentUrl}`),building_key:catalogueKey(`${slug}:${homeTypeName(home.name).toLowerCase()}`),name:home.name,source_url:home.url,bedrooms:home.bedrooms??null,price:home.price,plots:home.plots}));
 const links=report.properties.flatMap((home,i)=>[...new Set(home.imageIds)].filter(id=>knownImages.has(`${slug}:${id}`)).map((id,position)=>({gallery_key:galleries[i]!.key,image_key:`${slug}:${id}`,position})));
 const offers=developmentRows.flatMap(d=>{
  const detail=details.find(item=>item.url===d.source_url);
  const source=detail?.properties??report.properties.filter(h=>h.developmentUrl===d.source_url).map(h=>({bedrooms:h.bedrooms,price:h.price,style:null}));
  return [...new Map(source.map(p=>[JSON.stringify([p.bedrooms,p.price,p.style]),{development_key:d.key,bedrooms:p.bedrooms,price:p.price,style:p.style}])).values()];
 });
 const metadata={status:report.status,startedAt:report.startedAt,completedAt:report.completedAt,model:report.model,question:report.question,analysisVersion:report.analysisVersion,metrics:report.metrics};
 await sql.begin(async tx=>{
  await tx`select pg_advisory_xact_lock(726391042)`;
  await tx`select pg_advisory_xact_lock(hashtext(${slug}))`;
  const logo=logos.find(l=>l.slug===slug),office=offices.find(o=>o.slug===slug);
  await tx`insert into showhome_web.builders(slug,name,website_url,report_metadata,facts,logo_url,logo_background,office) values(${slug},${developer.name},${report.builder?.websiteUrl??developer.website},${tx.json(metadata)},${tx.json(builderFacts(slug))},${logo?'/logos/'+logo.file:null},${builderBrand(slug)?.logoBackground??'#fff'},${office?tx.json(office):null}) on conflict(slug) do update set name=excluded.name,website_url=excluded.website_url,report_metadata=excluded.report_metadata,facts=excluded.facts,logo_url=excluded.logo_url,logo_background=excluded.logo_background,office=excluded.office,imported_at=now()`;
  await tx`insert into showhome_web.gallery_summary_refresh_queue(builder_slug) values(${slug}) on conflict(builder_slug) do nothing`;
  await tx`delete from showhome_web.developments where builder_slug=${slug}`;
  await tx`delete from showhome_web.buildings where builder_slug=${slug}`;
  await tx`delete from showhome_web.images where builder_slug=${slug}`;
  await insert(tx,'developments',developmentRows);await insert(tx,'buildings',buildings);await insert(tx,'images',images);await insert(tx,'galleries',galleries);await insert(tx,'gallery_images',links);await insert(tx,'offers',offers);
 });
 return {builder:slug,developments:developmentRows.length,buildings:buildings.length,images:images.length,galleries:galleries.length,links:links.length};
}
