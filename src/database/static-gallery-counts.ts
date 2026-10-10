import {createHash} from 'node:crypto';
import type postgres from 'postgres';
import {cacheWrite} from './cache-write';
/** Publication-scoped totals are reused across every filter combination. */
export async function staticGalleryCounts(sql:postgres.Sql,identity:unknown,query:string,values:unknown[]):Promise<Record<string,number>>{
 const key='gallery:static-counts:v4:'+createHash('sha256').update(JSON.stringify(identity)).digest('hex');
 const [cached]=await sql`select r.revision,c.payload from showhome_web.publication_revision r left join showhome_web.query_cache c on c.key=${key} and c.revision=r.revision where r.singleton=true`;
 if(cached?.payload)return cached.payload;
 const [row]=await sql.unsafe(query,values as never);
 const counts={'Unique images':Number(row!.unique_images),Developments:Number(row!.developments),'Room Types':Number(row!.room_types)};
 await cacheWrite(()=>sql`insert into showhome_web.query_cache(key,revision,expires_at,payload) select ${key},revision,'infinity'::timestamptz,${sql.json(counts)} from showhome_web.publication_revision where singleton=true and revision=${cached!.revision} on conflict(key) do update set revision=excluded.revision,expires_at=excluded.expires_at,payload=excluded.payload`);
 return counts;
}
