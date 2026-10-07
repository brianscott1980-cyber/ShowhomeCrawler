import {cache} from 'react';
import {websiteDatabase} from './website';
import {cacheWrite} from './cache-write';
import {expandDevelopmentPublicRoutes,developmentPublicRoutes} from '../web/development-public-routes';
let memory:{revision:string|number;routes:ReturnType<typeof developmentPublicRoutes>}|undefined;
export const readDevelopmentPublicRoutes=cache(async()=>{
 const sql=websiteDatabase(),key='development:public-routes:v2';
 const [cached]=await sql`select r.revision,c.payload from showhome_web.publication_revision r left join showhome_web.query_cache c on c.key=${key} and c.revision=r.revision and r.revision<>${memory?.revision??-1}::bigint where r.singleton=true`;
 if(memory&&cached?.revision===memory.revision)return memory.routes;
 if(cached?.payload){const routes=expandDevelopmentPublicRoutes(cached.payload as [string,string][]);memory={revision:cached.revision,routes};return routes;}
 const [rows,builders]=await Promise.all([
  sql`select name,href from showhome_web.directory_cards where kind='locations' and is_ready=true and href is not null`,
  sql`select slug from showhome_web.builders`
 ]);
 const routes=developmentPublicRoutes(rows.map(row=>({name:String(row.name),href:String(row.href)})),builders.map(row=>String(row.slug)));
 await cacheWrite(()=>sql`insert into showhome_web.query_cache(key,revision,expires_at,payload) select ${key},revision,'infinity'::timestamptz,${sql.json(Object.entries(routes.canonical))} from showhome_web.publication_revision where singleton=true and revision=${cached!.revision} on conflict(key) do update set revision=excluded.revision,expires_at=excluded.expires_at,payload=excluded.payload`);
 memory={revision:cached!.revision,routes};
 return routes;
});
export async function resolveDevelopmentPublicRoute(path:string){return (await readDevelopmentPublicRoutes()).destinations[path.toLowerCase()];}

export async function publicDevelopmentCards<T extends {cards:any[];mapCards?:any[]}>(data:T):Promise<T>{
 const {canonical}=await readDevelopmentPublicRoutes();
 const card=(value:any)=>({...value,...(value.href?{href:canonical[value.href]??value.href}:{})});
 return {...data,cards:data.cards.map(card),...(data.mapCards?{mapCards:data.mapCards.map(card)}:{})};
}
