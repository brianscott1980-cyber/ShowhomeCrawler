import type postgres from 'postgres';
import {websiteDatabase} from './website';
import {selectedValues} from '../web/filter-selection';
import type {GalleryRequest,GalleryPageData} from '../web/gallery-page-data';
export async function queryGallery(input:GalleryRequest,sql:postgres.Sql=websiteDatabase()):Promise<GalleryPageData>{
 const {scope,filters={}}=input,values:unknown[]=[];
 const p=(v:unknown)=>{values.push(v);return '$'+values.length;};
 const favourite=scope.kind==='favourites';
 const [reference]=favourite?[{collection_slugs:[],category:null,building_name:null}]:await sql`select * from showhome_web.directory_cards where kind=${scope.kind} and href=${scope.href}`;
 if(!reference)throw new Error('Gallery not found');
 const scopeConditions=favourite?[`i.image_id in(select jsonb_array_elements_text(${p(sql.json(input.favourites??[]))}::jsonb))`]:[`i.builder_slug in(select jsonb_array_elements_text(${p(sql.json(reference.collection_slugs))}::jsonb))`,'i.eligible'];
 scopeConditions.push("nullif(trim(lower(i.category)), '') is not null and lower(trim(i.category)) not in ('other','uncategorised','uncategorized','unknown','interior','infographic','illustration','promotional graphic','marketing image','document','logo','map')");
 if(scope.kind==='interiors')scopeConditions.push("lower(trim(i.category)) not in ('exterior','floorplan','floor plan')");
 if(scope.kind==='interiors'&&reference.category)scopeConditions.push(`i.category=${p(reference.category)}`);
 const baseBuildingParam=scope.kind==='buildings'?p(reference.building_name):'',homeScope=scope.kind==='buildings'?`lower(h->>'buildingName')=lower(${baseBuildingParam}::text)`:'true';
 if(scope.kind==='buildings')scopeConditions.push(`i.building_names @> array[${p(reference.building_name.toLowerCase())}::text]`);
 const homesProjection=scope.kind==='buildings'?`coalesce((select jsonb_agg(h) from jsonb_array_elements(i.payload->'homes') h where ${homeScope}),'[]'::jsonb)`: `i.payload->'homes'`;
 const source=`select i.uid,i.builder_slug,i.builder_name,i.category,i.room,${filters.q?'i.search_text':"''::text as search_text"} from showhome_web.gallery_cards i where ${scopeConditions.join(' and ')}`;
 const homeSource=`select h.* from showhome_web.gallery_memberships h join source s on s.uid=h.uid ${scope.kind==='buildings'?`where h.building_name=lower(${baseBuildingParam}::text)`:''}`;
 const ctes=`source as (${source}),homes as (${homeSource})`;
 const baseValues=values.slice();
 const selection=(field:string,key:string,omit:string)=>{const selected=selectedValues(filters[key]??'');return omit===key||!selected.length?'true':`${field} in(select jsonb_array_elements_text(${p(sql.json(selected))}::jsonb))`;};
 function homeWhere(omit=''){
  const conditions=[selection("h.bedrooms::text",'bedrooms',omit),selection("h.development",'site',omit),selection("h.development_url",'development',omit)];
  if(omit!=='location'&&filters.location)conditions.push(`h.areas && array(select jsonb_array_elements_text(${p(sql.json(selectedValues(filters.location)))}::jsonb))`);
  for(const [key,field,op] of [['minBeds','bedrooms','>='],['maxBeds','bedrooms','<='],['minPrice','price','>='],['maxPrice','price','<=']] as const)if(key!==omit&&filters[key])conditions.push(`h.${field}${op}${p(Number(filters[key]))}::numeric`);
  return conditions.join(' and ');
 }
 function where(omit=''){
  const conditions=[selection('s.builder_name','developer',omit),selection('s.category','category',omit),selection('s.room','room',omit)];
  if(omit!=='q'&&filters.q)conditions.push(`position(${p(filters.q.toLowerCase())} in s.search_text)>0`);
  const homes=homeWhere(omit);
  if(['bedrooms','site','development','location','minBeds','maxBeds','minPrice','maxPrice'].some(k=>k!==omit&&filters[k]))conditions.push(`exists(select 1 from homes h where h.uid=s.uid and ${homes})`);
  return conditions.join(' and ');
 }
 const matched=where(),matchedValues=values.slice(),matchingHome=homeWhere(),matchValues=values.slice();
 values.splice(0,values.length,...matchedValues);
 const selected=input.selectedUid?`case when r.uid=${p(input.selectedUid)} then 0 else 1 end,`:'';
 const page=`with ${ctes},ranked as(select s.uid,row_number() over(order by s.uid)-1 as position from source s where ${matched}),batch as(select r.* from ranked r order by ${selected}r.uid limit ${p(input.limit??16)} offset ${p(input.offset??0)}) select i.payload||jsonb_build_object('homes',${homesProjection},'position',r.position) as payload from batch r join showhome_web.gallery_cards i on i.uid=r.uid order by ${selected}r.uid`;
 const pageValues=values.slice();
 if(input.imageOnly){const cards=await sql.unsafe(page,pageValues as never);return {images:cards.map(c=>c.payload),total:0,nextOffset:0,hasMore:false,counts:{},facets:{category:[],room:[],developer:[],bedrooms:[],location:[],site:[],development:[]}};}
 const summary=`with ${ctes} select count(distinct s.uid)::int as total,count(distinct h.builder_slug||':'||h.development_url)::int as developments,count(distinct h.builder_slug||':'||h.url)::int as properties from source s left join homes h on h.uid=s.uid and ${matchingHome} where ${matched}`;
 const facets=['category','room','developer','bedrooms','location','site','development'].map(key=>{
  values.splice(0,values.length,...baseValues);const homeFacet=['bedrooms','location','site','development'].includes(key),w=where(key),hw=homeFacet?homeWhere(key):'true';
  const imageField=key==='developer'?'s.builder_name':key==='room'?'s.room':'s.category';
  const homeField=key==='bedrooms'?"h.bedrooms":key==='location'?'a.area':key==='site'?"h.development":"h.development_url";
  const projection=key==='development'?`coalesce(jsonb_agg(distinct jsonb_build_array(h.development_url,h.development)) filter(where h.development_url is not null),'[]'::jsonb)`:`coalesce(jsonb_agg(distinct ${homeFacet?homeField:imageField} order by ${homeFacet?homeField:imageField}) filter(where ${homeFacet?homeField:imageField} is not null),'[]'::jsonb)`;
  return {key,values:values.slice(),query:`with ${ctes} select ${projection} as options from source s ${homeFacet?'join homes h on h.uid=s.uid':''} ${key==='location'?"cross join lateral unnest(h.areas) a(area)":''} where ${w} ${homeFacet?'and '+hw:''}`};
 });
 const [cards,totals,options]=await Promise.all([sql.unsafe(page,pageValues as never),sql.unsafe(summary,matchValues as never),Promise.all(facets.map(async f=>({key:f.key,rows:await sql.unsafe(f.query,f.values as never)})))]);
 const total=Number(totals[0]!.total),nextOffset=(input.offset??0)+cards.length;
 return {images:cards.map(c=>c.payload),total,nextOffset,hasMore:nextOffset<total,counts:{'Unique images':total,Developments:Number(totals[0]!.developments),Properties:Number(totals[0]!.properties)},facets:Object.fromEntries(options.map(o=>[o.key,o.rows[0]!.options])) as GalleryPageData['facets']};
}
