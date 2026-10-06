import {isCategorisedImage} from '../web/image-classification';
import {cache} from 'react';
import type postgres from 'postgres';
import {createDatabase} from './postgres';
import type {RunReport,ReportImage,ReportProperty} from '../reports/report';
import type {LocationRow} from '../web/location-geography';
import type {BuilderFacts} from '../web/builder-facts';
let connection:postgres.Sql|undefined;
export function websiteDatabase(){return connection??=createDatabase();}
export const readWebsiteBuilder=cache(async(slug:string)=>{
 const [row]=await websiteDatabase()`select * from showhome_web.builders where slug=${slug}`;
 return row as {slug:string;name:string;website_url:string;report_metadata:Omit<RunReport,'developments'|'properties'|'images'|'errors'>;facts:BuilderFacts;office:{address?:string}|null;logo_url:string|null;logo_background:string|null}|undefined;
});
export interface CollectionScope {developmentUrl?:string;buildingName?:string;category?:string}
export const readWebsiteCollection=cache(async(slug:string,scope?:CollectionScope):Promise<RunReport|null>=>{
 const sql=websiteDatabase(),builder=await readWebsiteBuilder(slug);if(!builder)return null;
 const galleries=await sql`select g.*,d.source_url as development_url,d.name as development_name from showhome_web.galleries g join showhome_web.developments d on d.key=g.development_key join showhome_web.buildings b on b.key=g.building_key where g.builder_slug=${slug} and (${scope?.developmentUrl??null}::text is null or d.source_url=${scope?.developmentUrl??null}) and (${scope?.buildingName??null}::text is null or b.name=${scope?.buildingName??null})`;
 const keys=galleries.map(g=>String(g.key));
 const [images,links,developments]=await Promise.all([
  sql`select i.metadata from showhome_web.images i where i.builder_slug=${slug} and (${scope?.category??null}::text is null or i.main_category=${scope?.category??null}) and (${Boolean(scope?.developmentUrl||scope?.buildingName)}=false or exists(select 1 from showhome_web.gallery_images gi where gi.image_key=i.key and gi.gallery_key=any(${keys}::text[]))) order by i.catalogue_id`,
  sql`select gi.gallery_key,i.catalogue_id from showhome_web.gallery_images gi join showhome_web.images i on i.key=gi.image_key where gi.gallery_key=any(${keys}::text[]) order by gi.gallery_key,gi.position`,
  sql`select source_url,name,town,country,crawl_metadata from showhome_web.developments where builder_slug=${slug} and (${scope?.developmentUrl??null}::text is null or source_url=${scope?.developmentUrl??null})`
 ]);
 const ids=new Map<string,string[]>();for(const link of links){const list=ids.get(link.gallery_key)??[];list.push(link.catalogue_id);ids.set(link.gallery_key,list);}
 const properties:ReportProperty[]=galleries.map(g=>({development:g.development_name,developmentUrl:g.development_url,name:g.name,url:g.source_url,bedrooms:g.bedrooms,price:g.price===null?null:Number(g.price),plots:g.plots,imageIds:ids.get(g.key)??[]}));
 return {...builder.report_metadata,builder:{slug,name:builder.name,websiteUrl:builder.website_url},errors:[],developments:developments.map(d=>({...d.crawl_metadata,url:d.source_url,name:d.name,town:d.town,country:d.country})),properties,images:images.map(i=>i.metadata as ReportImage).filter(isCategorisedImage)} as RunReport;
});
export const readWebsiteLocations=cache(async(slug:string):Promise<LocationRow[]>=>{
 const rows=await websiteDatabase()`select name,source_url as url,town,country,postcode,latitude,longitude,geography from showhome_web.developments where builder_slug=${slug}`;
 return rows as unknown as LocationRow[];
});
export async function readWebsiteOffers(slug:string){
 const rows=await websiteDatabase()`select d.source_url as url,d.property_scope as scope,jsonb_agg(jsonb_build_object('price',o.price,'bedrooms',o.bedrooms,'style',o.style)) filter(where o.id is not null) as properties from showhome_web.developments d left join showhome_web.offers o on o.development_key=d.key where d.builder_slug=${slug} group by d.key`;
 return rows.map(r=>({...r,properties:r.properties??[]}));
}
export async function readDirectoryCards<T>(kind:string):Promise<T[]>{
 const rows=await websiteDatabase()`select payload from showhome_web.directory_cards where kind=${kind} order by name,key`;
 return rows.map(r=>r.payload as T);
}
export async function readPresentation<T>(key:string):Promise<T>{
 const [row]=await websiteDatabase()`select payload from showhome_web.presentations where key=${key}`;
 if(!row)throw new Error('Website catalogue has not been published: '+key);
 if(key.startsWith('builder:')&&row.payload.report)row.payload.report.images=row.payload.report.images.filter(isCategorisedImage);
 return row.payload as T;
}
export const findDirectoryReference=cache(async(kind:string,href:string)=>{
 const [row]=await websiteDatabase()`select * from showhome_web.directory_cards where kind=${kind} and href=${href}`;
 return row;
});

export async function findWebsiteImage(slug:string,path:string,id:string){
 const [row]=await websiteDatabase()`select source_url from showhome_web.images where builder_slug=${slug} and catalogue_id=${id} and path=${path}`;return row?{sourceUrl:String(row.source_url)}:null;
}

export async function readWebsiteSitemap(){
 const sql=websiteDatabase();
 const [cards,builders]=await Promise.all([
  sql`select href from showhome_web.directory_cards order by kind,name,key`,
  sql`select b.slug,b.report_metadata->>'completedAt' as completed_at,jsonb_agg(i.path order by i.catalogue_id) as images from showhome_web.builders b join showhome_web.images i on i.builder_slug=b.slug and i.eligible group by b.slug`
 ]);
 return {cards,builders};
}
