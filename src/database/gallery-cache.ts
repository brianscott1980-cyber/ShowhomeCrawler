import {cascadingFiltersEnabled} from '../web/filter-settings';
import {cacheWrite} from './cache-write';
import {createHash} from 'node:crypto';
import {websiteDatabase} from './website';
import {queryGallery} from './gallery-query';
import type {GalleryRequest,GalleryPageData} from '../web/gallery-page-data';
import type postgres from 'postgres';
export async function cachedGallery(input:GalleryRequest,sql:postgres.Sql=websiteDatabase(),query:(input:GalleryRequest)=>Promise<GalleryPageData>=(input)=>queryGallery(input,sql)):Promise<GalleryPageData>{
 if(input.scope.kind==='favourites'||input.imageOnly||input.filters?.q)return query(input);
 const filters=Object.fromEntries(Object.entries(input.filters??{}).filter(([,v])=>v).sort(([a],[b])=>a.localeCompare(b)));
 const defaultPage=(input.offset??0)===0&&!input.selectedUid&&!Object.entries(filters).some(([key,value])=>value!==input.scope.fixedFilters?.[key]);
 const key='gallery:static-rolodex-v9:'+createHash('sha256').update(JSON.stringify({scope:input.scope,...(input.scope.kind==='buildings'?{exteriorPolicy:'majority-v1'}:{}),filters,cascading:cascadingFiltersEnabled(),offset:input.offset??0,limit:input.limit??16,selectedUid:input.selectedUid??''})).digest('hex');
 const [row]=await sql`select r.revision,c.payload from showhome_web.publication_revision r left join showhome_web.query_cache c on c.key=${key} and c.revision=r.revision and c.expires_at>now() where r.singleton=true`;
 if(row?.payload){const data=row.payload as GalleryPageData;return {...data,counts:{'Unique images':data.counts['Unique images']!,Developments:data.counts.Developments!,Properties:data.counts.Properties!}};}
 const data=await query(input);
 await cacheWrite(()=>sql`insert into showhome_web.query_cache(key,revision,expires_at,payload) select ${key},revision,case when ${defaultPage}::boolean then 'infinity'::timestamptz else now()+interval '24 hours' end,${sql.json(data as never)} from showhome_web.publication_revision where singleton=true and revision=${row!.revision} on conflict(key) do update set revision=excluded.revision,expires_at=excluded.expires_at,payload=excluded.payload`);
 return data;
}
