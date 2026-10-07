import {directoryTotalCache} from './directory-total-cache';
import {cascadingFiltersEnabled} from '../web/filter-settings';
import {interiorCardCounts} from './interior-card-counts';
import type postgres from 'postgres';
import {websiteDatabase} from './website';
import {selectedValues} from '../web/filter-selection';
import type {DirectoryPageData,DirectoryRequest} from '../web/directory-page-data';
export async function queryDirectory(input:DirectoryRequest,sql:postgres.Sql=websiteDatabase()):Promise<DirectoryPageData>{
 const {kind,point}=input;
 const filters={...input.filters,...input.fixedFilters},scoped=Boolean(Object.keys(input.fixedFilters??{}).length);
 const limit=input.limit??16,offset=input.offset??0;
 const totalCache=!cascadingFiltersEnabled()?await directoryTotalCache(sql,input):undefined;
 const values:unknown[]=[];
 const param=(value:unknown)=>{values.push(value);return '$'+values.length;};
 const kindParam=param(kind);
 const pointLat=param(point?.latitude??null),pointLon=param(point?.longitude??null);
 const miles=`case when ${pointLat}::float8 is not null and r.latitude is not null and r.longitude is not null then 3958.7613*acos(least(1.0,greatest(-1.0,sin(radians(${pointLat}::float8))*sin(radians(r.latitude))+cos(radians(${pointLat}::float8))*cos(radians(r.latitude))*cos(radians(r.longitude-${pointLon}::float8))))) end`;
 function selection(field:string,key:string,omit:string){const selected=selectedValues(filters[key]??'');return (!input.fixedFilters?.[key]&&(omit&&!cascadingFiltersEnabled()||key===omit))||!selected.length?'true':`${field} in (select jsonb_array_elements_text(${param(sql.json(selected))}::jsonb))`;}
 function range(field:string,key:string,comparison:string,omit:string){const value=filters[key];return omit&&!cascadingFiltersEnabled()||key===omit||omit==='beds'&&/Beds$/.test(key)||omit==='price'&&/Price$/.test(key)||!value||value==='any'?'true':`${field}${comparison}${param(Number(value))}::numeric`;}
 function rowWhere(omit=''){
  const applyFilters=!omit||cascadingFiltersEnabled();
  const conditions=[`r.kind=${kindParam}`,`(${pointLat}::float8 is null or (${pointLat}::float8 between -90 and 90 and ${pointLon}::float8 between -180 and 180))`,selection('r.developer','developer',omit),selection('c.name','type',omit),selection('r.site','site',omit),selection('r.region','region',omit)];
  if(kind==='locations'||kind==='buildings')conditions.push('c.is_ready=true');
  if(kind==='interiors')conditions.push("lower(trim(c.name)) not in ('other','uncategorised','uncategorized','unknown','interior','infographic','illustration','promotional graphic','marketing image','document','logo','map','exterior','floorplan','floor plan')");
  if(applyFilters&&kind==='interiors'&&omit!=='building'&&filters.building)conditions.push(`exists(select 1 from showhome_web.gallery_memberships h join showhome_web.gallery_card_index i on i.uid=h.uid where i.category=c.category and i.eligible and i.builder_name=r.developer and (r.site is null or h.development=r.site) and (r.bedrooms is null or h.bedrooms=r.bedrooms) and ${selection('h.building_name','building',omit)})`);
  if(applyFilters&&omit!=='bedrooms' &&filters.bedrooms)conditions.push(selection('r.bedrooms::text','bedrooms',omit));
  if(applyFilters&&omit!=='location'&&filters.location)conditions.push(`r.areas && array(select jsonb_array_elements_text(${param(sql.json(selectedValues(filters.location)))}::jsonb))`);
  for(const [field,key,op] of [['r.bedrooms','minBeds','>='],['r.bedrooms','maxBeds','<='],['r.price','minPrice','>='],['r.price','maxPrice','<=']] as const)conditions.push(range(field,key,op,omit));
  if(applyFilters&&omit!=='radius'&&filters.radius&&point)conditions.push(`${miles}<=${param(Number(filters.radius))}::float8`);
  return conditions.join(' and ');
 }
 const baseWhere=rowWhere(),baseValues=values.slice();
 const keys=input.keys!==undefined?`and c.key in(select jsonb_array_elements_text(${param(sql.json(input.keys!))}::jsonb))`:'';
 const spacesExpr=kind==='builders'?"max(coalesce((c.payload->>'spaces')::int,0))":"0";
 const milesExpr=point?`min(${miles})`:"null::float8";
 const matched=`select c.key,c.name,min(r.price) as min_price,max(r.price) as max_price,${milesExpr} as miles,${spacesExpr} as spaces from showhome_web.directory_cards c join showhome_web.directory_filter_rows r on r.kind=c.kind and r.card_key=c.key where ${baseWhere} ${keys} group by c.kind,c.key,c.name`;
 const sort=filters.order==='name-desc'?'m.name desc,m.key':filters.order==='price-asc'?'m.min_price asc nulls last,m.name,m.key':filters.order==='price-desc'?'m.max_price desc nulls last,m.name,m.key':filters.order==='distance'?'m.miles asc nulls last,m.name,m.key':filters.order==='spaces'?'m.spaces desc,m.name,m.key':'m.name,m.key';
 const matchedValues=values.slice();
 const preferred=input.selectedKey?`case when m.key=${param(input.selectedKey)} then 0 else 1 end,`:'';
 const limitParam=param(limit),offsetParam=param(offset),pageValues=values.slice();
 const builderPayload=`jsonb_build_object('totalDevelopments',jsonb_array_length(c.payload->'locations'),'locations',coalesce((select jsonb_agg(jsonb_build_object('name',r.site,'key',r.site_id,'region',r.region,'latitude',r.latitude,'longitude',r.longitude,'buildingTypes',r.building_types)) from showhome_web.directory_filter_rows r where r.kind=c.kind and r.card_key=c.key and ${baseWhere}),'[]'::jsonb))`;
 const pageQuery=`with matched as (${matched}) select (c.payload-'places'-'interiorIds')||${kind==='builders'?builderPayload:kind==='buildings'?`jsonb_build_object('logo',(select b.logo_url from showhome_web.builders b where b.slug=c.builder_slug),'logoBackground',(select b.logo_background from showhome_web.builders b where b.slug=c.builder_slug))`:`'{}'::jsonb`}||jsonb_build_object('miles',m.miles) as payload from matched m join showhome_web.directory_cards c on c.kind=${kindParam} and c.key=m.key order by ${preferred}${sort} limit ${limitParam} offset ${offsetParam}`;
 const summaryQuery=totalCache?.total!==undefined?`select ${totalCache.total}::int as total,null::text[] as keys`:`with matched as (${matched}) select count(*)::int as total,${cascadingFiltersEnabled()?'array_agg(key)':'null::text[]'} as keys from matched`;
 values.splice(0,values.length,...baseValues.slice(0,3));
 const countWhere=scoped&&!cascadingFiltersEnabled()?rowWhere('counts'):baseWhere;
 const countValues=scoped&&!cascadingFiltersEnabled()?values.slice():matchedValues;
 const aggregateQuery=`select count(distinct c.key)::int as cards,count(distinct r.site_id)::int as developments,count(distinct (r.developer||':'||b.type))::int as buildings,count(distinct i.image)::int as interiors,count(distinct c.key) filter(where c.name not in('Exterior','Uncategorised'))::int as rooms from showhome_web.directory_cards c join showhome_web.directory_filter_rows r on r.kind=c.kind and r.card_key=c.key left join lateral unnest(r.building_types) b(type) on true left join lateral unnest(case when c.name not in('Exterior','Uncategorised') then r.image_ids else '{}'::text[] end) i(image) on true where ${countWhere} ${scoped&&!cascadingFiltersEnabled()?'':keys}`;
 // Facets ignore their own selection but retain every other correlated criterion.
 const facetNames=totalCache?.facets?[]:kind==='locations'?['developer','beds','price']:kind==='builders'?['region']:['developer','bedrooms','location','site','type',...(kind==='interiors'?['building']:[])];
 const facetQueries=facetNames.map(key=>{
  values.splice(0,values.length,...baseValues.slice(0,3));
  const where=rowWhere(key);
  const field=key==='building'?'h.building_name':key==='beds'||key==='bedrooms'?'r.bedrooms':key==='price'?'r.price':key==='type'?'c.name':key==='location'?'a.area':key==='developer'?'r.developer':key==='site'?'r.site':'r.region';
  const projection=key==='price'?`jsonb_build_array(min(${field}),max(${field}))`:`coalesce(jsonb_agg(distinct ${field} order by ${field}) filter(where ${field} is not null),'[]'::jsonb)`;
  if(key==='building'){
   values.splice(0,values.length,...baseValues.slice(0,3));
   const conditions=["i.eligible","lower(trim(i.category)) not in ('other','uncategorised','uncategorized','unknown','interior','infographic','illustration','promotional graphic','marketing image','document','logo','map','exterior','floorplan','floor plan')"];
   if(cascadingFiltersEnabled()&&filters.developer)conditions.push(selection('i.builder_name','developer','building'));
   if(cascadingFiltersEnabled()&&filters.type)conditions.push(selection('i.category','type','building'));
   if(cascadingFiltersEnabled()&&filters.site)conditions.push(selection('h.development','site','building'));
   if(cascadingFiltersEnabled()&&filters.bedrooms)conditions.push(selection('h.bedrooms::text','bedrooms','building'));
   if(cascadingFiltersEnabled()&&filters.location)conditions.push(`h.areas && array(select jsonb_array_elements_text(${param(sql.json(selectedValues(filters.location)))}::jsonb))`);
   const hasFilters=cascadingFiltersEnabled()&&Boolean(filters.developer||filters.type||filters.site||filters.bedrooms||filters.location);
   const query=hasFilters
    ?`select ${projection} as options from showhome_web.gallery_memberships h join showhome_web.gallery_card_index i on i.uid=h.uid where ${conditions.join(' and ')}`
    :`select coalesce(jsonb_agg(distinct c.building_name order by c.building_name) filter(where c.building_name is not null),'[]'::jsonb) as options from showhome_web.directory_cards c where c.kind='buildings' and c.is_ready=true`;
   return {key,query,values:values.slice()};
  }
  return {key,query:`select ${projection} as options from showhome_web.directory_cards c join showhome_web.directory_filter_rows r on r.kind=c.kind and r.card_key=c.key ${key==='location'?'cross join lateral unnest(r.areas) a(area)':''} where ${where}`,values:values.slice()};
 });
 const mapQuery=`select jsonb_build_object('key',c.key,'name',c.name,'href',c.href,'developer',c.payload->>'developer','latitude',c.payload->'latitude','longitude',c.payload->'longitude','country',c.payload->'country','town',c.payload->'town','image','','description',c.name,'count',c.payload->'count','properties','[]'::jsonb) as payload from showhome_web.directory_cards c where c.kind=${kindParam} and exists(select 1 from showhome_web.directory_filter_rows r where r.kind=c.kind and r.card_key=c.key and ${baseWhere}) order by c.name,c.key`;
 const combinedValues=baseValues.slice(0,3);
 const branch=(query:string,parameters:unknown[])=>{
  const offset=combinedValues.length-3;combinedValues.push(...parameters.slice(3));
  return query.replace(/\$(\d+)/g,(_,number:string)=>'$'+(Number(number)>3?Number(number)+offset:Number(number)));
 };
 const pageBranch=branch(pageQuery,pageValues),summaryBranch=branch(summaryQuery,totalCache?.total!==undefined?baseValues.slice(0,3):matchedValues),countBranch=(cascadingFiltersEnabled()||scoped&&!totalCache?.counts)?branch(aggregateQuery,countValues):'';
 const options=facetQueries.map(f=>({key:f.key,query:branch(f.query,f.values)}));
 const mapBranch=kind==='locations'?branch(mapQuery,baseValues):'';
 values.splice(0,values.length,...baseValues.slice(0,3));
 const publishedCountBranch=totalCache?.counts&&scoped?branch(`select ${param(sql.json(totalCache.counts))}::jsonb as published_counts`,values.slice()):`select coalesce((select payload from showhome_web.presentations where key='counts:${kind}'),'{}'::jsonb) as published_counts`;
 const combined=`with page_result as (${pageBranch}),total_result as (${summaryBranch}),count_result as (${countBranch||publishedCountBranch})
 select coalesce((select jsonb_agg(payload) from page_result),'[]'::jsonb) as cards,(select row_to_json(total_result) from total_result) as totals,${countBranch?'(select row_to_json(count_result) from count_result)':'(select published_counts from count_result)'} as counts,jsonb_build_object(${options.map(f=>`'${f.key}',(${f.query})`).join(',')}) as facets,${mapBranch?`coalesce((select jsonb_agg(payload) from (${mapBranch}) pins),'[]'::jsonb)`:"'[]'::jsonb"} as map_cards`;
 const [result]=await sql.unsafe(combined,combinedValues as never);
 if(totalCache?.facets)result!.facets=totalCache.facets;
 else if(totalCache)await totalCache.saveFacets(result!.facets);
 const cards=(result!.cards as any[]).map(payload=>({payload})),totalRows=[result!.totals],countRows=[result!.counts];
 const facetRows=Object.entries(result!.facets).map(([key,options])=>({key,rows:[{options:options as (string|number)[]}]}));
 const mapRows=(result!.map_cards as any[]).map(payload=>({payload}));
 if(cascadingFiltersEnabled()&&kind==='interiors'&&cards.length){
  const counts=await interiorCardCounts(filters.building?totalRows[0]?.keys??[]:cards.map(c=>c.payload.key),filters,sql);
  if(filters.building&&countRows[0])countRows[0].interiors=[...counts.uniqueCounts.values()].reduce((sum,value)=>sum+value,0);
  for(const card of cards)card.payload={...card.payload,count:counts.get(card.payload.key)??0};
 }
 const total=Number(totalRows[0]?.total??0),counts:Record<string,unknown>=countRows[0]??{};
 if(scoped&&totalCache&&!totalCache.counts)await totalCache.saveCounts(counts as Record<string,number>);
 if(totalCache&&totalCache.total===undefined)await totalCache.save(total);
 return {cards:cards.map(c=>c.payload),total,nextOffset:offset+cards.length,hasMore:offset+cards.length<total,facets:Object.fromEntries(facetRows.map(f=>[f.key,(f.rows[0]?.options??[]).filter((v:unknown)=>v!==null)])),counts:!cascadingFiltersEnabled()&&!scoped?counts as Record<string,number>:kind==='locations'?{Developments:scoped&&!cascadingFiltersEnabled()?Number(counts.cards):total}:kind==='builders'?{Builders:total,Developments:Number(counts.developments),'Building types':Number(counts.buildings)}:kind==='buildings'?{Styles:scoped&&!cascadingFiltersEnabled()?Number(counts.cards):total,Developments:Number(counts.developments)}:{'Room types':Number(counts.rooms),Interiors:Number(counts.interiors)},...(kind==='locations'?{mapCards:mapRows.map(r=>r.payload)}:{})};
}
