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
