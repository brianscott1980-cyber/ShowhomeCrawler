import type postgres from 'postgres';
import {cacheWrite} from './cache-write';
import {websiteDatabase} from './website';
/** Shared presentation cache, invalidated by catalogue publication. */
export async function cachedPresentation<T>(name:string,sql:postgres.Sql=websiteDatabase()):Promise<T>{
 const key=`presentation:v1:${name}`;
 const [cached]=await sql`select r.revision,c.payload from showhome_web.publication_revision r left join showhome_web.query_cache c on c.key=${key} and c.revision=r.revision where r.singleton=true`;
 if(cached?.payload)return cached.payload as T;
 const [row]=await sql`select payload from showhome_web.presentations where key=${name}`;
 if(!row)throw new Error('Website catalogue has not been published: '+name);
 await cacheWrite(()=>sql`insert into showhome_web.query_cache(key,revision,expires_at,payload) select ${key},revision,'infinity'::timestamptz,${sql.json(row.payload)} from showhome_web.publication_revision where singleton=true and revision=${cached!.revision} on conflict(key) do update set revision=excluded.revision,expires_at=excluded.expires_at,payload=excluded.payload`);
 return row.payload as T;
}
