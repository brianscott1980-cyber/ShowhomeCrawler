import {galleryProjection} from './gallery-projection';
import {directoryFilterRows} from './filter-rows';
import {builderOverviewProjection} from './builder-overview';
const nullableMin=(values:number[])=>values.length?Math.min(...values):null;
const nullableMax=(values:number[])=>values.length?Math.max(...values):null;
import {developers,readCollection} from '../web/collections';
import type {Collection} from '../web/groups';
import {createDatabase} from '../database/postgres';
import {builderDirectoryData,groupDirectoryData} from './directory-projections';
import {computeHomepageData} from './homepage-projection';
export async function publishWebsite(sql:ReturnType<typeof createDatabase>){
 await sql.begin(async tx=>{
  await tx`select pg_advisory_xact_lock(726391042)`;
 const collections:Collection[]=(await Promise.all(developers.map(async d=>{const report=await readCollection(d.slug);return report?{slug:d.slug,name:d.name,report}:null;}))).filter(c=>c!==null);
 const builder=await builderDirectoryData(collections);
 const directories:(Awaited<ReturnType<typeof groupDirectoryData>>&{kind:string})[]=[];
 for(const kind of ['locations','buildings','interiors'] as const){const data=await groupDirectoryData(kind,collections);directories.push({kind,...data});console.log(kind,data.cards.length);}
 const home=await computeHomepageData(collections);
 const overviews=await Promise.all(collections.map(async c=>({key:`builder:${c.slug}`,payload:await builderOverviewProjection(c)})));
  await tx`delete from showhome_web.gallery_cards`;
  for(const collection of collections){const rows=await galleryProjection(collection);for(let offset=0;offset<rows.length;offset+=200)await tx.unsafe('insert into showhome_web.gallery_cards select * from jsonb_populate_recordset(null::showhome_web.gallery_cards,$1::jsonb)',[tx.json(rows.slice(offset,offset+200) as never)]);}
  await tx`insert into showhome_web.gallery_memberships select c.uid,g.key,g.builder_slug,g.source_url,g.bedrooms,g.price,d.source_url,d.name,b.name,array(select distinct value from jsonb_each_text(d.geography) where value is not null and value<>'') from showhome_web.gallery_cards c join showhome_web.images i on i.builder_slug=c.builder_slug and i.catalogue_id=c.image_id join showhome_web.gallery_images gi on gi.image_key=i.key join showhome_web.galleries g on g.key=gi.gallery_key join showhome_web.developments d on d.key=g.development_key join showhome_web.buildings b on b.key=g.building_key`;
  await tx`delete from showhome_web.directory_cards`;
  for(const {kind,cards,references} of directories){
   const ref=new Map(references.map(r=>[r.key,r]));
   for(let offset=0;offset<cards.length;offset+=100){
    const rows=cards.slice(offset,offset+100).map(card=>{const reference=ref.get(card.key)!;return {kind,key:card.key,name:card.name,href:card.href,builder_slug:reference.builderSlug,collection_slugs:reference.slugs,development_url:reference.developmentUrl,building_name:reference.buildingName,category:reference.category,min_price:'properties' in card?nullableMin(card.properties.map(p=>p.price).filter((v):v is number=>typeof v==='number')):null,max_price:'properties' in card?nullableMax(card.properties.map(p=>p.price).filter((v):v is number=>typeof v==='number')):null,payload:card};});
    await tx.unsafe(`insert into showhome_web.directory_cards(kind,key,name,href,builder_slug,collection_slugs,development_url,building_name,category,min_price,max_price,payload) select kind,key,name,href,builder_slug,collection_slugs,development_url,building_name,category,min_price,max_price,payload from jsonb_populate_recordset(null::showhome_web.directory_cards,$1::jsonb)`,[tx.json(rows as never)]);
   }
  }
  for(const card of builder.cards)await tx`insert into showhome_web.directory_cards(kind,key,name,href,builder_slug,collection_slugs,payload) values('builders',${card.slug},${card.name},${'/builders/'+card.slug},${card.slug},${[card.slug]},${tx.json(card as never)})`;
  const memberships=[...directories,{kind:'builders',cards:builder.cards}].flatMap(({kind,cards})=>cards.flatMap(card=>directoryFilterRows(kind,card)));
  for(let offset=0;offset<memberships.length;offset+=500){
   const rows=memberships.slice(offset,offset+500).map(row=>({developer:null,bedrooms:null,price:null,style:null,site:null,site_id:null,areas:[],region:null,latitude:null,longitude:null,image_ids:[],building_types:[],...row}));
   await tx.unsafe(`insert into showhome_web.directory_filter_rows(kind,card_key,developer,bedrooms,price,style,site,site_id,areas,region,latitude,longitude,image_ids,building_types) select kind,card_key,developer,bedrooms,price,style,site,site_id,areas,region,latitude,longitude,image_ids,building_types from jsonb_populate_recordset(null::showhome_web.directory_filter_rows,$1::jsonb)`,[tx.json(rows as never)]);
  }
  for(const {kind,counts} of [...directories,{kind:'builders',counts:builder.counts}])await tx`insert into showhome_web.presentations(key,payload) values(${`counts:${kind}`},${tx.json(counts)}) on conflict(key) do update set payload=excluded.payload,updated_at=now()`;
  for(const overview of overviews)await tx`insert into showhome_web.presentations(key,payload) values(${overview.key},${tx.json(overview.payload as never)}) on conflict(key) do update set payload=excluded.payload,updated_at=now()`;
  await tx`insert into showhome_web.presentations(key,payload) values('homepage',${tx.json(home as never)}) on conflict(key) do update set payload=excluded.payload,updated_at=now()`;
  await tx`update showhome_web.publication_revision set revision=revision+1 where singleton=true`;
  await tx`delete from showhome_web.query_cache`;
 });
 await sql`analyze showhome_web.gallery_memberships,showhome_web.gallery_cards,showhome_web.directory_cards,showhome_web.directory_filter_rows`;
 console.log('Website projections published atomically');
}
