import {refreshDirectoryReadiness} from '../catalogue/publish';
import {clearGalleryProjection,insertGalleryProjection,refreshGalleryMemberships} from '../catalogue/gallery-storage';
import {parseArgs} from 'node:util';
import {websiteDatabase,readWebsiteCollection} from '../database/website';
import {builderDirectoryData,groupDirectoryData} from '../catalogue/directory-projections';
import {builderOverviewProjection} from '../catalogue/builder-overview';
import {directoryFilterRows} from '../catalogue/filter-rows';
import {galleryProjection} from '../catalogue/gallery-projection';
const {values}=parseArgs({options:{builder:{type:'string'},apply:{type:'boolean',default:false}}});
if(!values.builder)throw Error('Pass --builder <slug> [--apply]');
const sql=websiteDatabase();
try{
 const slug=values.builder,report=await readWebsiteCollection(slug);if(!report)throw Error('Builder not found');
 const collection={slug,name:report.builder!.name,report};
 const builder=await builderDirectoryData([collection]),overview=await builderOverviewProjection(collection);
 const directories=await Promise.all(['locations','buildings'].map(async kind=>({kind,...await groupDirectoryData(kind as 'locations'|'buildings',[collection])})));
 console.log(JSON.stringify({builder:slug,categorisedImages:report.images.length,counts:overview.counts,apply:values.apply}));
 if(values.apply)await sql.begin(async tx=>{
  await tx`select pg_advisory_xact_lock(726391042)`;
  await tx`delete from showhome_web.directory_cards where builder_slug=${slug} and kind in ('locations','buildings','builders')`;
  for(const directory of directories){
   const references=new Map(directory.references.map(r=>[r.key,r]));
   for(const card of directory.cards){const ref=references.get(card.key)!;
    await tx`insert into showhome_web.directory_cards(kind,key,name,href,builder_slug,collection_slugs,development_url,building_name,category,payload) values(${directory.kind},${card.key},${card.name},${card.href!},${slug},${[slug]},${ref.developmentUrl},${ref.buildingName},${ref.category},${tx.json(card as never)})`;
   }
  }
  for(const card of builder.cards)await tx`insert into showhome_web.directory_cards(kind,key,name,href,builder_slug,collection_slugs,payload) values('builders',${slug},${card.name},${'/builders/'+slug},${slug},${[slug]},${tx.json(card as never)})`;
  const filterRows=[...directories,{kind:'builders',cards:builder.cards}].flatMap(({kind,cards})=>cards.flatMap(card=>directoryFilterRows(kind,card))).map(row=>({developer:null,bedrooms:null,price:null,style:null,site:null,site_id:null,areas:[],region:null,latitude:null,longitude:null,image_ids:[],building_types:[],...row}));
  for(let offset=0;offset<filterRows.length;offset+=250)await tx.unsafe(`insert into showhome_web.directory_filter_rows(kind,card_key,developer,bedrooms,price,style,site,site_id,areas,region,latitude,longitude,image_ids,building_types) select kind,card_key,developer,bedrooms,price,style,site,site_id,areas,region,latitude,longitude,image_ids,building_types from jsonb_populate_recordset(null::showhome_web.directory_filter_rows,$1::jsonb)`,[tx.json(filterRows.slice(offset,offset+250) as never)]);
  await clearGalleryProjection(tx,slug);
  await insertGalleryProjection(tx,await galleryProjection(collection));
  await refreshGalleryMemberships(tx,slug);
  await tx`update showhome_web.presentations set payload=${tx.json(overview as never)},updated_at=now() where key=${'builder:'+slug}`;
  await refreshDirectoryReadiness(tx);
  await tx`update showhome_web.publication_revision set revision=revision+1 where singleton=true`;
  await tx`delete from showhome_web.query_cache`;
 });
 console.log(values.apply?'Builder projections repaired.':'Preview only; pass --apply to repair.');
}finally{await sql.end();}
