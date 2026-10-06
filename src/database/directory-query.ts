import {interiorCardCounts} from './interior-card-counts';
import type postgres from 'postgres';
import {websiteDatabase} from './website';
import {selectedValues} from '../web/filter-selection';
import type {DirectoryPageData,DirectoryRequest} from '../web/directory-page-data';
export async function queryDirectory(input:DirectoryRequest,sql:postgres.Sql=websiteDatabase()):Promise<DirectoryPageData>{
 const {kind,filters={},point}=input,limit=input.limit??16,offset=input.offset??0;
 const values:unknown[]=[];
 const param=(value:unknown)=>{values.push(value);return '$'+values.length;};
 const kindParam=param(kind);
 const pointLat=param(point?.latitude??null),pointLon=param(point?.longitude??null);
 const miles=`case when ${pointLat}::float8 is not null and r.latitude is not null and r.longitude is not null then 3958.7613*acos(least(1.0,greatest(-1.0,sin(radians(${pointLat}::float8))*sin(radians(r.latitude))+cos(radians(${pointLat}::float8))*cos(radians(r.latitude))*cos(radians(r.longitude-${pointLon}::float8))))) end`;
 function selection(field:string,key:string,omit:string){const selected=selectedValues(filters[key]??'');return key===omit||!selected.length?'true':`${field} in (select jsonb_array_elements_text(${param(sql.json(selected))}::jsonb))`;}
 function range(field:string,key:string,comparison:string,omit:string){const value=filters[key];return key===omit||omit==='beds'&&/Beds$/.test(key)||omit==='price'&&/Price$/.test(key)||!value||value==='any'?'true':`${field}${comparison}${param(Number(value))}::numeric`;}
 function rowWhere(omit=''){
  const conditions=[`r.kind=${kindParam}`,`(${pointLat}::float8 is null or (${pointLat}::float8 between -90 and 90 and ${pointLon}::float8 between -180 and 180))`,selection('r.developer','developer',omit),selection('c.name','type',omit),selection('r.site','site',omit),selection('r.region','region',omit)];
  if(kind==='locations')conditions.push(`(c.builder_slug,c.development_url) in(select d.builder_slug,d.source_url from showhome_web.developments d join showhome_web.galleries g on g.development_key=d.key join showhome_web.gallery_images gi on gi.gallery_key=g.key join showhome_web.images i on i.key=gi.image_key where i.eligible and nullif(trim(i.main_category),'') is not null and lower(trim(i.main_category)) not in ('other','uncategorised','uncategorized','unknown','interior','infographic','illustration','promotional graphic','marketing image','document','logo','map'))`);
  if(kind==='buildings')conditions.push(`(c.builder_slug,lower(c.building_name)) in(select i.builder_slug,lower(name) from showhome_web.gallery_cards i cross join lateral unnest(i.building_names) name where i.eligible and nullif(trim(i.category),'') is not null and lower(trim(i.category)) not in ('other','uncategorised','uncategorized','unknown','interior','infographic','illustration','promotional graphic','marketing image','document','logo','map'))`);
  if(kind==='interiors')conditions.push("lower(trim(c.name)) not in ('other','uncategorised','uncategorized','unknown','interior','infographic','illustration','promotional graphic','marketing image','document','logo','map','exterior','floorplan','floor plan')");
  if(kind==='interiors'&&omit!=='building'&&filters.building)conditions.push(`exists(select 1 from showhome_web.gallery_memberships h join showhome_web.gallery_cards i on i.uid=h.uid where i.category=c.category and i.eligible and i.builder_name=r.developer and (r.site is null or h.development=r.site) and (r.bedrooms is null or h.bedrooms=r.bedrooms) and ${selection('h.building_name','building',omit)})`);
  if(omit!=='bedrooms' &&filters.bedrooms)conditions.push(selection('r.bedrooms::text','bedrooms',omit));
  if(omit!=='location'&&filters.location)conditions.push(`r.areas && array(select jsonb_array_elements_text(${param(sql.json(selectedValues(filters.location)))}::jsonb))`);
  for(const [field,key,op] of [['r.bedrooms','minBeds','>='],['r.bedrooms','maxBeds','<='],['r.price','minPrice','>='],['r.price','maxPrice','<=']] as const)conditions.push(range(field,key,op,omit));
  if(omit!=='radius'&&filters.radius&&point)conditions.push(`${miles}<=${param(Number(filters.radius))}::float8`);
  return conditions.join(' and ');
 }
 const baseWhere=rowWhere(),baseValues=values.slice();
 const keys=input.keys!==undefined?`and c.key in(select jsonb_array_elements_text(${param(sql.json(input.keys!))}::jsonb))`:'';
 const matched=`select c.key,c.name,min(r.price) as min_price,max(r.price) as max_price,min(${miles}) as miles,max(coalesce((c.payload->>'spaces')::int,0)) as spaces from showhome_web.directory_cards c join showhome_web.directory_filter_rows r on r.kind=c.kind and r.card_key=c.key where ${baseWhere} ${keys} group by c.kind,c.key,c.name`;
 const sort=filters.order==='name-desc'?'m.name desc,m.key':filters.order==='price-asc'?'m.min_price asc nulls last,m.name,m.key':filters.order==='price-desc'?'m.max_price desc nulls last,m.name,m.key':filters.order==='distance'?'m.miles asc nulls last,m.name,m.key':filters.order==='spaces'?'m.spaces desc,m.name,m.key':'m.name,m.key';
 const matchedValues=values.slice();
 const preferred=input.selectedKey?`case when m.key=${param(input.selectedKey)} then 0 else 1 end,`:'';
 const limitParam=param(limit),offsetParam=param(offset),pageValues=values.slice();
 const builderPayload=`jsonb_build_object('totalDevelopments',jsonb_array_length(c.payload->'locations'),'locations',coalesce((select jsonb_agg(jsonb_build_object('name',r.site,'key',r.site_id,'region',r.region,'latitude',r.latitude,'longitude',r.longitude,'buildingTypes',r.building_types)) from showhome_web.directory_filter_rows r where r.kind=c.kind and r.card_key=c.key and ${baseWhere}),'[]'::jsonb))`;
 const pageQuery=`with matched as (${matched}) select (c.payload-'places'-'interiorIds')||${kind==='builders'?builderPayload:kind==='buildings'?`jsonb_build_object('logo',(select b.logo_url from showhome_web.builders b where b.slug=c.builder_slug),'logoBackground',(select b.logo_background from showhome_web.builders b where b.slug=c.builder_slug))`:`'{}'::jsonb`}||jsonb_build_object('miles',m.miles) as payload from matched m join showhome_web.directory_cards c on c.kind=${kindParam} and c.key=m.key order by ${preferred}${sort} limit ${limitParam} offset ${offsetParam}`;
 const summaryQuery=`with matched as (${matched}) select count(*)::int as total,array_agg(key) as keys from matched`;
 const aggregateQuery=`select count(distinct c.key)::int as cards,count(distinct r.site_id)::int as developments,count(distinct (r.developer||':'||b.type))::int as buildings,count(distinct i.image)::int as interiors,count(distinct c.key) filter(where c.name not in('Exterior','Uncategorised'))::int as rooms from showhome_web.directory_cards c join showhome_web.directory_filter_rows r on r.kind=c.kind and r.card_key=c.key left join lateral unnest(r.building_types) b(type) on true left join lateral unnest(case when c.name not in('Exterior','Uncategorised') then r.image_ids else '{}'::text[] end) i(image) on true where ${baseWhere} ${keys}`;
 // Facets ignore their own selection but retain every other correlated criterion.
 const facetNames=kind==='locations'?['developer','beds','price']:kind==='builders'?['region']:['developer','bedrooms','location','site','type',...(kind==='interiors'?['building']:[])];
 const facetQueries=facetNames.map(key=>{
  values.splice(0,values.length,...baseValues.slice(0,3));
  const where=rowWhere(key);
  const field=key==='building'?'h.building_name':key==='beds'||key==='bedrooms'?'r.bedrooms':key==='price'?'r.price':key==='type'?'c.name':key==='location'?'a.area':key==='developer'?'r.developer':key==='site'?'r.site':'r.region';
  const projection=key==='price'?`jsonb_build_array(min(${field}),max(${field}))`:`coalesce(jsonb_agg(distinct ${field} order by ${field}) filter(where ${field} is not null),'[]'::jsonb)`;
  return {key,query:`select ${projection} as options from showhome_web.directory_cards c join showhome_web.directory_filter_rows r on r.kind=c.kind and r.card_key=c.key ${key==='building'?"join showhome_web.gallery_cards i on i.category=c.category and i.builder_name=r.developer and i.eligible join showhome_web.gallery_memberships h on h.uid=i.uid and (r.site is null or h.development=r.site) and (r.bedrooms is null or h.bedrooms=r.bedrooms)":''} ${key==='location'?'cross join lateral unnest(r.areas) a(area)':''} where ${where}`,values:values.slice()};
 });
 const mapQuery=`select jsonb_build_object('key',c.key,'name',c.name,'href',c.href,'developer',c.payload->>'developer','latitude',c.payload->'latitude','longitude',c.payload->'longitude','country',c.payload->'country','town',c.payload->'town','image','','description',c.name,'count',c.payload->'count','properties','[]'::jsonb) as payload from showhome_web.directory_cards c where c.kind=${kindParam} and exists(select 1 from showhome_web.directory_filter_rows r where r.kind=c.kind and r.card_key=c.key and ${baseWhere}) order by c.name,c.key`;
 const [cards,totalRows,countRows,facetRows,mapRows]=await Promise.all([
  sql.unsafe(pageQuery,pageValues as never),sql.unsafe(summaryQuery,matchedValues as never),sql.unsafe(aggregateQuery,matchedValues as never),
  Promise.all(facetQueries.map(async f=>({key:f.key,rows:await sql.unsafe(f.query,f.values as never)}))),
  kind==='locations'?sql.unsafe(mapQuery,baseValues as never):Promise.resolve([])
 ]);
 if(kind==='interiors'&&cards.length){
  const counts=await interiorCardCounts(filters.building?totalRows[0]?.keys??[]:cards.map(c=>c.payload.key),filters,sql);
  if(filters.building&&countRows[0])countRows[0].interiors=[...counts.uniqueCounts.values()].reduce((sum,value)=>sum+value,0);
  for(const card of cards)card.payload={...card.payload,count:counts.get(card.payload.key)??0};
 }
 const total=Number(totalRows[0]?.total??0),counts:Record<string,unknown>=countRows[0]??{};
 return {cards:cards.map(c=>c.payload),total,nextOffset:offset+cards.length,hasMore:offset+cards.length<total,facets:Object.fromEntries(facetRows.map(f=>[f.key,(f.rows[0]?.options??[]).filter((v:unknown)=>v!==null)])),counts:kind==='locations'?{Developments:total}:kind==='builders'?{Builders:total,Developments:Number(counts.developments),'Building types':Number(counts.buildings)}:kind==='buildings'?{Styles:total,Developments:Number(counts.developments)}:{'Room types':Number(counts.rooms),Interiors:Number(counts.interiors)},...(kind==='locations'?{mapCards:mapRows.map(r=>r.payload)}:{})};
}
