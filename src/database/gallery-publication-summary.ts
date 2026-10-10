import {createHash} from 'node:crypto';
import type postgres from 'postgres';
import type {GalleryScope,GalleryPageData} from '../web/gallery-page-data';
export interface GalleryPublicationSummary {total:number;counts:Record<string,number>;facets:GalleryPageData['facets']}
export function gallerySummaryKey(scope:GalleryScope){
 return createHash('sha256').update(JSON.stringify({kind:scope.kind,href:scope.href==='/interiors'?'/interiors/all':scope.href,...(scope.furnishing?{furnishing:scope.furnishing.toLowerCase().trim()}:{}),...(scope.fixedFilters?{fixedFilters:Object.fromEntries(Object.entries(scope.fixedFilters).sort())}:{})})).digest('hex');
}
export async function readGalleryPublicationSummary(sql:postgres.Sql,scope:GalleryScope):Promise<GalleryPublicationSummary|undefined>{
 if(scope.kind==='favourites')return undefined;
 const [row]=await sql`select payload from showhome_web.gallery_publication_summaries where key=${gallerySummaryKey(scope)}`;
 return row?.payload as GalleryPublicationSummary|undefined;
}

import {queryGallery} from './gallery-query';

export async function refreshGalleryPublicationSummaries(sql:postgres.Sql|postgres.TransactionSql){
 const queuedRows=await sql`select builder_slug from showhome_web.gallery_summary_refresh_queue`;
 const queuedBuilders=queuedRows.map(r=>String(r.builder_slug));
 const rooms=await sql`select distinct href,category,collection_slugs from showhome_web.directory_cards where kind='interiors' and lower(trim(coalesce(category,''))) not in ('exterior','floorplan','floor plan','other','uncategorised','uncategorized','unknown','infographic','illustration','promotional graphic','marketing image','document','logo','map') order by href`;
 const scopes:GalleryScope[]=[{kind:'interiors',href:'/interiors/all'},...rooms.map(r=>({kind:'interiors' as const,href:String(r.href)}))];
 for(const scope of scopes){
  const key=gallerySummaryKey(scope);
  const card=rooms.find(r=>r.href===scope.href);
  const builders=(scope.href==='/interiors/all'||scope.href==='/interiors')?[]:(card?.collection_slugs??[]);
  const summary=await queryGallery({scope,limit:1},sql as postgres.Sql);
  const payload:GalleryPublicationSummary={total:summary.total,counts:summary.counts,facets:summary.facets};
  const fingerprint=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  await sql`insert into showhome_web.gallery_publication_summaries(key,scope,builders,fingerprint,payload,updated_at)
   values(${key},${sql.json(scope as never)},${builders},${fingerprint},${sql.json(payload as never)},now())
   on conflict(key) do update set scope=excluded.scope,builders=excluded.builders,fingerprint=excluded.fingerprint,payload=excluded.payload,updated_at=now()`;
 }
 if(queuedBuilders.length){
  await sql`delete from showhome_web.gallery_summary_refresh_queue where builder_slug=any(${queuedBuilders}::text[])`;
 }
}
