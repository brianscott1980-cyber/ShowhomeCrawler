import {createHash} from 'node:crypto';
import type postgres from 'postgres';
import type {DirectoryRequest} from '../web/directory-page-data';
import {cacheWrite} from './cache-write';
/** Page size, offset, selection and sorting do not change the matching total. */
export async function directoryTotalCache(sql:postgres.Sql,input:DirectoryRequest){
 const filters=Object.fromEntries(Object.entries(input.filters??{}).filter(([key,value])=>value&&['developer','region','radius','bedrooms','location','site','type','building','minBeds','maxBeds','minPrice','maxPrice'].includes(key)).sort(([a],[b])=>a.localeCompare(b)));
 const key='directory:total:v1:'+createHash('sha256').update(JSON.stringify({kind:input.kind,fixedFilters:input.fixedFilters,filters,point:filters.radius?input.point:null,keys:input.keys===undefined?null:[...input.keys].sort()})).digest('hex');
 const facetKey='directory:facets:v2:'+input.kind+':'+JSON.stringify(input.fixedFilters??{});
 const countKey='directory:scoped-counts:v1:'+input.kind+':'+JSON.stringify(input.fixedFilters??{});
 const [row]=await sql.unsafe(`select r.revision,c.payload,f.payload as facets,n.payload as counts from showhome_web.publication_revision r left join showhome_web.query_cache c on c.key=$1 and c.revision=r.revision left join showhome_web.query_cache f on f.key=$2 and f.revision=r.revision left join showhome_web.query_cache n on n.key=$3 and n.revision=r.revision where r.singleton=true`,[key,facetKey,countKey]);
 const total=Number(row?.payload?.total);
 return {counts:row?.counts as Record<string,number>|undefined,saveCounts:async(counts:Record<string,number>)=>{
  await cacheWrite(()=>sql.unsafe(`insert into showhome_web.query_cache(key,revision,expires_at,payload) select $1,revision,'infinity'::timestamptz,$2::jsonb from showhome_web.publication_revision where singleton=true and revision=$3 on conflict(key) do update set revision=excluded.revision,expires_at=excluded.expires_at,payload=excluded.payload`,[countKey,sql.json(counts),row?.revision]));
 },facets:row?.facets as Record<string,(string|number)[]>|undefined,saveFacets:async(facets:Record<string,(string|number)[]>)=>{
  await cacheWrite(()=>sql.unsafe(`insert into showhome_web.query_cache(key,revision,expires_at,payload) select $1,revision,'infinity'::timestamptz,$2::jsonb from showhome_web.publication_revision where singleton=true and revision=$3 on conflict(key) do update set revision=excluded.revision,expires_at=excluded.expires_at,payload=excluded.payload`,[facetKey,sql.json(facets),row?.revision]));
 },total:row?.payload&&Number.isSafeInteger(total)&&total>=0?total:undefined,save:async(value:number)=>{
  await cacheWrite(()=>sql.unsafe(`insert into showhome_web.query_cache(key,revision,expires_at,payload) select $1,revision,'infinity'::timestamptz,jsonb_build_object('total',$2::int) from showhome_web.publication_revision where singleton=true and revision=$3 on conflict(key) do update set revision=excluded.revision,expires_at=excluded.expires_at,payload=excluded.payload`,[key,value,row?.revision]));
 }};
}
