import {resolveFurnishingCategory} from './furnishings';
import {readGalleryPublicationSummary} from './gallery-publication-summary';
import {colourPattern} from '../web/interior-tags';
import {staticGalleryFacets} from './static-gallery-facets';
import {staticGalleryCounts} from './static-gallery-counts';
import {cascadingFiltersEnabled} from '../web/filter-settings';
import type postgres from 'postgres';
import {websiteDatabase} from './website';
import {selectedValues} from '../web/filter-selection';
import type {GalleryRequest,GalleryPageData} from '../web/gallery-page-data';
export async function queryGallery(input:GalleryRequest,sql:postgres.Sql=websiteDatabase(),queryOptions:{prepareSummary?:boolean}={}):Promise<GalleryPageData>{
 const scope={...input.scope},filters={...input.filters},fixed=input.scope.fixedFilters??{},values:unknown[]=[];
 if(scope.furnishing)scope.furnishing=await resolveFurnishingCategory(scope.furnishing,sql);
 if(filters.furnishing){
  const selected=selectedValues(filters.furnishing);
  const labels=await sql`select source_name,category_name from showhome_web.furnishing_category_mappings where source_name=any(${selected.map(v=>v.toLowerCase().trim())}::text[])`;
  const mapped=new Map(labels.map(r=>[String(r.source_name),r.category_name]));
  filters.furnishing=JSON.stringify(selected.map(v=>String(mapped.get(v.toLowerCase().trim())??v).trim().toLowerCase()));
 }
 const preparing=Boolean(queryOptions.prepareSummary);
 const published=!preparing&&!input.imageOnly&&!cascadingFiltersEnabled()?await readGalleryPublicationSummary(sql,scope):undefined;
 const p=(v:unknown)=>{values.push(v);return '$'+values.length;};
 const favourite=scope.kind==='favourites',distinctImages=scope.kind==='interiors';
 const isAll=scope.kind==='interiors'&&(scope.href==='/interiors/all'||scope.href==='/interiors');
 const [reference]=favourite||isAll?[{collection_slugs:[],category:null,building_name:null}]:await sql`select * from showhome_web.directory_cards where kind=${scope.kind} and href=${scope.href}`;
 if(!reference)throw new Error('Gallery not found');
 const scopeConditions=favourite?[`i.image_id in(select jsonb_array_elements_text(${p(sql.json(input.favourites??[]))}::jsonb))`]:isAll?['i.eligible']:[`i.builder_slug=any(${p(reference.collection_slugs)}::text[])`,'i.eligible'];
 if(fixed.developer)scopeConditions.push(`i.builder_name in(select jsonb_array_elements_text(${p(sql.json(selectedValues(fixed.developer)))}::jsonb))`);
 scopeConditions.push("nullif(trim(lower(i.category)), '') is not null and lower(trim(i.category)) not in ('other','uncategorised','uncategorized','unknown','interior','infographic','illustration','promotional graphic','marketing image','document','logo','map')");
 if(scope.kind==='interiors')scopeConditions.push("lower(trim(i.category)) not in ('exterior','floorplan','floor plan')");
 if(scope.kind==='interiors'&&reference.category)scopeConditions.push(`i.category=${p(reference.category)}`);
 if(scope.kind==='buildings')scopeConditions.push('not exists(select 1 from showhome_web.images exterior where exterior.builder_slug=i.builder_slug and exterior.catalogue_id=i.image_id and exterior.is_generic_exterior)');
 const baseBuildingParam=scope.kind==='buildings'?p(reference.building_name):'';
 if(scope.kind==='buildings')scopeConditions.push(`i.building_names @> array[${p(reference.building_name.toLowerCase())}::text]`);
 if(scope.kind==='buildings')scopeConditions.push(`t.building_name=lower(${baseBuildingParam}::text)`);
 if(scope.furnishing){
  scopeConditions.push(`exists(select 1 from showhome_web.image_furnishing_categories fm where fm.builder_slug=i.builder_slug and fm.image_id=i.image_id and fm.name=${p(scope.furnishing.toLowerCase().trim())})`);
 }
 const facetCache=published&&!filters.furnishing?{facets:published.facets}:!preparing&&!input.imageOnly&&!cascadingFiltersEnabled()?await staticGalleryFacets(sql,{scope,favourites:input.favourites,furnishing:filters.furnishing??''}):undefined;
 const tagScope=scope.kind==='interiors'||scope.kind==='buildings';
 const needTags=tagScope&&Boolean(fixed.colour||filters.imageTag||filters.interiorColour||filters.furnishingColour||filters.colour||filters.tag||!input.imageOnly&&!facetCache?.facets);
 const tagArrays=['colours','objects','chairs','decor','wallpaperTags','curtainTags','fabricTags','furnishingTags'];
 const cat="m.metadata->'categorisation'";
 const furnishingSelection=scope.furnishing?[scope.furnishing.toLowerCase().trim()]:selectedValues(filters.furnishing??'').map(v=>v.toLowerCase().trim());
 const furnishingCondition=needTags&&furnishingSelection.length?`exists(select 1 from showhome_web.furnishing_category_mappings cm where cm.source_name=lower(trim(a->>'object')) and cm.category_name in(select jsonb_array_elements_text(${p(sql.json(furnishingSelection))}::jsonb)))`:'true';
 const interiorLabels=`array(select distinct initcap(trim(c)) from jsonb_array_elements(coalesce(${cat}->'interiorColours','[]'::jsonb)) a cross join lateral jsonb_array_elements_text(coalesce(a->'colours','[]'::jsonb)) c where a->>'prominence' in ('dominant','secondary','accent'))`;
 const furnishingLabels=`array(select distinct initcap(trim(c)) from jsonb_array_elements(coalesce(${cat}->'furnishings','[]'::jsonb)) a cross join lateral jsonb_array_elements_text(coalesce(a->'colours','[]'::jsonb)) c where ${furnishingCondition})`;
 const tagJoin=needTags?`left join showhome_web.images m on m.builder_slug=i.builder_slug and m.catalogue_id=i.image_id left join lateral (
 select array_agg(distinct lower(label)) as image_tags,array_agg(distinct label) filter(where label ~* '${colourPattern}') as colour_tags,array_agg(distinct label) filter(where label !~* '${colourPattern}') as other_tags
 from (select distinct trim(value) as label from jsonb_array_elements_text(${tagArrays.map(key=>`coalesce(${cat}->'${key}','[]'::jsonb)`).join('||')}||coalesce((select jsonb_agg(f->>'object') from jsonb_array_elements(coalesce(${cat}->'furnishings','[]'::jsonb)) f),'[]'::jsonb)||jsonb_build_array(${cat}->>'wallpaper',${cat}->>'curtains',case when ${cat}->>'hasTelevision'='true' then 'Television' end,case when ${cat}->>'hasComputer'='true' then 'Computer' end)) value where nullif(trim(value),'') is not null) labels
 ) tags on true`:'';
 const structuredFields=needTags?`,${interiorLabels} as interior_colour_tags,${furnishingLabels} as furnishing_colour_tags`:',array[]::text[] as interior_colour_tags,array[]::text[] as furnishing_colour_tags';
 const indexedFurnishings=`array(select initcap(f.name) from showhome_web.image_furnishing_categories f where f.builder_slug=i.builder_slug and f.image_id=i.image_id and f.name !~* '${colourPattern}' order by f.name)`;
 const imageLabels=`coalesce(tags.image_tags,array[]::text[])||array(select lower(label) from unnest(${interiorLabels}||array(select initcap(trim(c)) from jsonb_array_elements(coalesce(${cat}->'furnishings','[]'::jsonb)) a cross join lateral jsonb_array_elements_text(coalesce(a->'colours','[]'::jsonb)) c)) label)`;
 const tagFields=needTags?`,${imageLabels} as image_tags,${scope.furnishing?furnishingLabels:'tags.colour_tags'} as colour_tags,tags.other_tags,${indexedFurnishings} as furnishing_tags`:",array[]::text[] as image_tags,array[]::text[] as colour_tags,array[]::text[] as other_tags,array[]::text[] as furnishing_tags";
 const homeRows=distinctImages?`select related.builder_slug,related.builder_name,h from showhome_web.gallery_cards related cross join lateral jsonb_array_elements(related.payload->'homes') h where related.image_id=i.image_id`:`select i.builder_slug,i.builder_name,h from jsonb_array_elements(i.payload->'homes') h where r.building_name is null or lower(h->>'buildingName')=r.building_name`;
 const homesProjection=`coalesce((select jsonb_agg(h||jsonb_build_object('builderSlug',members.builder_slug,'builderName',members.builder_name)||coalesce((select jsonb_build_object('builderLogo',b.logo_url,'builderLogoBackground',b.logo_background) from showhome_web.builders b where b.slug=members.builder_slug),'{}'::jsonb)||coalesce((select jsonb_build_object('buildingHref',c.href,'buildingImage',c.payload->>'image') from showhome_web.directory_cards c where c.kind='buildings' and c.collection_slugs @> array[members.builder_slug]::text[] and lower(c.building_name)=lower(h->>'buildingName') order by c.href limit 1),'{}'::jsonb)||coalesce((select jsonb_build_object('latitude',d.latitude,'longitude',d.longitude) from showhome_web.developments d where d.builder_slug=members.builder_slug and d.source_url=h->>'developmentUrl'),'{}'::jsonb)) from (${homeRows}) members),'[]'::jsonb)`;
 if(fixed.colour)scopeConditions.push(`tags.colour_tags && array(select jsonb_array_elements_text(${p(sql.json(selectedValues(fixed.colour)))}::jsonb))`);
 const source=`select ${distinctImages?'i.uid':`case when cardinality(i.building_names)>1 then i.uid||':house:'||t.building_name else i.uid end`} as uid,i.uid as image_uid,i.image_id,${distinctImages?'null::text':'t.building_name'} as building_name,i.builder_slug,i.builder_name,i.category,i.room${tagFields}${structuredFields},${filters.q?'i.search_text':"''::text as search_text"} from showhome_web.gallery_card_index i ${distinctImages?'':'left join lateral(select distinct lower(name) as building_name from unnest(i.building_names) name) t on true'} ${tagJoin} where ${scopeConditions.join(' and ')}`;
 // For single-builder scopes, resolve memberships from each image using the
 // existing identity/link indexes rather than joining the full catalogue first.
 const memberships=!isAll&&!favourite&&reference.collection_slugs.length===1?`lateral(select h.* from showhome_web.gallery_memberships h where h.uid=s.image_uid and (s.building_name is null or h.building_name=s.building_name) offset 0)`:'showhome_web.gallery_memberships';
 const homeSource=`select s.uid,h.gallery_key,h.builder_slug,h.url,h.bedrooms,h.price,h.development_url,h.development,h.building_name,h.areas from source s join ${memberships} h on s.image_uid=h.uid and (s.building_name is null or h.building_name=s.building_name)`;
 const ctes=`source as (${source}),homes as (${homeSource})`;
 const baseValues=values.slice();
 const selection=(field:string,key:string,omit:string)=>{const selected=selectedValues(filters[key]??'');return omit===key||!selected.length?'true':`${field} in(select jsonb_array_elements_text(${p(sql.json(selected))}::jsonb))`;};
 function homeWhere(omit=''){
  if(omit&&!cascadingFiltersEnabled())return 'true';
  const conditions=[selection('h.building_name','building',omit),selection("h.bedrooms::text",'bedrooms',omit),selection("h.development",'site',omit),selection("h.development_url",'development',omit)];
  if(omit!=='location'&&filters.location)conditions.push(`h.areas && array(select jsonb_array_elements_text(${p(sql.json(selectedValues(filters.location)))}::jsonb))`);
  for(const [key,field,op] of [['minBeds','bedrooms','>='],['maxBeds','bedrooms','<='],['minPrice','price','>='],['maxPrice','price','<=']] as const)if(key!==omit&&filters[key])conditions.push(`h.${field}${op}${p(Number(filters[key]))}::numeric`);
  return conditions.join(' and ');
 }
 function where(omit=''){
  if(omit&&!cascadingFiltersEnabled())return 'true';
  const conditions=[selection('s.builder_name','developer',omit),selection('s.category','category',omit),selection('s.room','room',omit)];
  for(const [key,field] of [['interiorColour','interior_colour_tags'],['furnishingColour','furnishing_colour_tags'],['colour','colour_tags'],['tag','other_tags']])if(omit!==key&&filters[key!])conditions.push(`s.${field} && array(select jsonb_array_elements_text(${p(sql.json(selectedValues(filters[key!]!)))}::jsonb))`);
  if(filters.imageTag)conditions.push(`s.image_tags && array(select lower(trim(value)) from jsonb_array_elements_text(${p(sql.json(selectedValues(filters.imageTag)))}::jsonb))`);
  if(omit!=='furnishing'&&filters.furnishing)conditions.push(`exists(select 1 from showhome_web.image_furnishing_categories ff where ff.builder_slug=s.builder_slug and ff.image_id=s.image_id and ff.name !~* '${colourPattern}' and ff.name in(select lower(trim(value)) from jsonb_array_elements_text(${p(sql.json(selectedValues(filters.furnishing)))}::jsonb)))`);
  if(omit!=='q'&&filters.q)conditions.push(`position(${p(filters.q.toLowerCase())} in s.search_text)>0`);
  const homes=homeWhere(omit);
  if(['building','bedrooms','site','development','location','minBeds','maxBeds','minPrice','maxPrice'].some(k=>k!==omit&&filters[k]))conditions.push(`exists(select 1 from homes h where h.uid=s.uid and ${homes})`);
  return conditions.join(' and ');
 }
 const matched=where(),matchedValues=values.slice(),matchingHome=homeWhere(),matchValues=values.slice();
 values.splice(0,values.length,...matchedValues);
 const selected=input.selectedUid?`case when (r.uid=${p(input.selectedUid)} or r.image_uid=${p(input.selectedUid)}) then 0 else 1 end,`:'';
 const page=`with ${ctes},ranked as(select chosen.*,row_number() over(order by chosen.uid)-1 as position from (select ${distinctImages?'distinct on (s.image_id)':''} s.uid,s.image_uid,s.building_name from source s where ${matched} ${distinctImages?'order by s.image_id,s.uid':''}) chosen),batch as(select r.* from ranked r order by ${selected}r.uid limit ${p(input.limit??16)} offset ${p(input.offset??0)}) select i.payload||coalesce((select jsonb_build_object('builderLogo',b.logo_url,'builderLogoBackground',b.logo_background) from showhome_web.builders b where b.slug=i.builder_slug),'{}'::jsonb)||jsonb_build_object('uid',r.uid,'imageUid',r.image_uid,'homes',${homesProjection},'position',r.position) as payload from batch r join showhome_web.gallery_cards i on i.uid=r.image_uid order by ${selected}r.uid`;
 const pageValues=values.slice();
 if(input.imageOnly){const cards=await sql.unsafe(page,pageValues as never);return {images:cards.map(c=>c.payload),total:0,nextOffset:0,hasMore:false,counts:{},facets:{category:[],room:[],developer:[],bedrooms:[],location:[],site:[],development:[]}};}
 const unfiltered=Object.entries(filters).every(([key,value])=>!value||value===fixed[key]);
 const summary=published&&unfiltered?`with ${ctes} select ${Number(published.total)}::int as total`:preparing||cascadingFiltersEnabled()?`with ${ctes} select count(distinct ${distinctImages?'s.image_id':'s.uid'})::int as total,count(distinct ${distinctImages?'s.image_id':'s.image_uid'})::int as unique_images,count(distinct h.builder_slug||':'||h.development_url)::int as developments,count(distinct nullif(trim(s.room),'')) filter(where lower(trim(s.room))<>'blank')::int as room_types from source s left join homes h on h.uid=s.uid and ${matchingHome} where ${matched}`:`with ${ctes} select count(distinct ${distinctImages?'s.image_id':'s.uid'})::int as total from source s where ${matched}`;
 const facets=(facetCache?.facets?[]:['category','room','developer','bedrooms','location','site','development','building',...(tagScope?['colour','tag','furnishing','interiorColour','furnishingColour']:[])]).map(key=>{
  values.splice(0,values.length,...baseValues);const homeFacet=['bedrooms','location','site','development','building'].includes(key),w=where(key),hw=homeFacet?homeWhere(key):'true';
  const imageField=['colour','tag','furnishing','interiorColour','furnishingColour'].includes(key)?'labels.label':key==='developer'?'s.builder_name':key==='room'?'s.room':'s.category';
  const homeField=key==='building'?'h.building_name':key==='bedrooms'?"h.bedrooms":key==='location'?'a.area':key==='site'?"h.development":"h.development_url";
  const projection=key==='development'?`coalesce(jsonb_agg(distinct jsonb_build_array(h.development_url,h.development)) filter(where h.development_url is not null),'[]'::jsonb)`:`coalesce(jsonb_agg(distinct ${homeFacet?homeField:imageField} order by ${homeFacet?homeField:imageField}) filter(where ${homeFacet?homeField:imageField} is not null),'[]'::jsonb)`;
  return {key,values:values.slice(),query:`with ${ctes} select ${projection} as options from source s ${homeFacet?'join homes h on h.uid=s.uid':''} ${['colour','tag','furnishing','interiorColour','furnishingColour'].includes(key)?`cross join lateral unnest(s.${key==='interiorColour'?'interior_colour_tags':key==='furnishingColour'?'furnishing_colour_tags':key==='colour'?'colour_tags':key==='furnishing'?'furnishing_tags':'other_tags'}) labels(label)`:''} ${key==='location'?"cross join lateral unnest(h.areas) a(area)":''} where ${w} ${homeFacet?'and '+hw:''}`};
 });
 // Reuse the scoped image and home relations for the page, counters and every
 // cascading facet. Separate statements rebuilt these relations nine times.
 const combinedValues=baseValues.slice();
 const branch=(query:string,parameters:unknown[])=>{
  const offset=combinedValues.length-baseValues.length;
  combinedValues.push(...parameters.slice(baseValues.length));
  return query.slice(`with ${ctes} `.length).replace(/\$(\d+)/g,(_,number:string)=>{
   const index=Number(number);return '$'+(index>baseValues.length?index+offset:index);
  });
 };
 const pageBranch=preparing?"ranked as (select null::text as uid,null::text as image_uid,null::text as building_name,0 as position where false),batch as (select * from ranked) select null::jsonb as payload where false":branch(page,pageValues);
 const summaryBranch=branch(summary,cascadingFiltersEnabled()?matchValues:matchedValues);
 const facetBranches=facets.map(f=>({key:f.key,query:branch(f.query,f.values)}));
 const combined=`with source as materialized (${source}),homes as materialized (${homeSource}),
 page_result as (with ${pageBranch}),summary_result as (${summaryBranch})
 select coalesce((select jsonb_agg(payload) from page_result),'[]'::jsonb) as cards,
 (select row_to_json(summary_result) from summary_result) as totals,
 jsonb_build_object(${facetBranches.map(f=>`'${f.key}',(${f.query})`).join(',')}) as facets`;
 const [result]=await sql.unsafe(combined,combinedValues as never);
 if(facetCache?.facets)result!.facets=facetCache.facets;
 else if(facetCache&&'save' in facetCache)await facetCache.save(result!.facets);
 const cards=(result!.cards as GalleryPageData['images']).map(payload=>({payload}));
 const totals=[result!.totals];
 const options=Object.entries(result!.facets).map(([key,options])=>({key,rows:[{options}]}));
 const stableCounts=published?.counts??(!preparing&&!cascadingFiltersEnabled()?await staticGalleryCounts(sql,{scope,favourites:input.favourites},`with ${ctes} select count(distinct ${distinctImages?'s.image_id':'s.image_uid'})::int as unique_images,count(distinct h.builder_slug||':'||h.development_url)::int as developments,count(distinct nullif(trim(s.room),'')) filter(where lower(trim(s.room))<>'blank')::int as room_types from source s left join homes h on h.uid=s.uid`,baseValues):undefined);
 const total=Number(totals[0]!.total),nextOffset=(input.offset??0)+cards.length;
 return {images:cards.map(c=>c.payload),total,nextOffset,hasMore:nextOffset<total,counts:stableCounts??{'Unique images':Number(totals[0]!.unique_images),Developments:Number(totals[0]!.developments),'Room Types':Number(totals[0]!.room_types)},facets:Object.fromEntries(options.map(o=>[o.key,['room','category'].includes(o.key)?(o.rows[0]!.options as unknown[]).filter((value:unknown)=>typeof value==='string'&&value.trim()&&value.trim().toLowerCase()!=='blank'):o.rows[0]!.options])) as GalleryPageData['facets']};
}
