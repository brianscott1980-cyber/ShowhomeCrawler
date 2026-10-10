import {createHash} from 'node:crypto';
import type postgres from 'postgres';
import type {GalleryPageData} from '../web/gallery-page-data';
import {cacheWrite} from './cache-write';
export async function staticGalleryFacets(sql:postgres.Sql,identity:unknown){
 const key='gallery:static-facets:v7:'+createHash('sha256').update(JSON.stringify(identity)).digest('hex');
 const [row]=await sql`select r.revision,c.payload from showhome_web.publication_revision r left join showhome_web.query_cache c on c.key=${key} and c.revision=r.revision where r.singleton=true`;
 return {facets:row?.payload as GalleryPageData['facets']|undefined,save:async(facets:GalleryPageData['facets'])=>{
  await cacheWrite(()=>sql`insert into showhome_web.query_cache(key,revision,expires_at,payload) select ${key},revision,'infinity'::timestamptz,${sql.json(facets as never)} from showhome_web.publication_revision where singleton=true and revision=${row!.revision} on conflict(key) do update set revision=excluded.revision,expires_at=excluded.expires_at,payload=excluded.payload`);
 }};
}
