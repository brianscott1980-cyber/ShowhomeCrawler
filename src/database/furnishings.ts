import {cache} from 'react';
import type postgres from 'postgres';
import {websiteDatabase} from './website';
import {cacheWrite} from './cache-write';
import {colourPattern} from '../web/interior-tags';
export interface Furnishing {name:string;slug:string;count:number;image:string}
export async function queryFurnishings(sql:postgres.Sql=websiteDatabase()):Promise<Furnishing[]>{
 const rows=await sql.unsafe(`with items as (
 select distinct lower(trim(label)) as name,i.uid,m.path as path,i.builder_slug
 from showhome_web.gallery_card_index i join showhome_web.images m on m.builder_slug=i.builder_slug and m.catalogue_id=i.image_id
 cross join lateral jsonb_array_elements_text(coalesce(m.metadata->'categorisation'->'objects','[]'::jsonb)||coalesce(m.metadata->'categorisation'->'chairs','[]'::jsonb)||coalesce((select jsonb_agg(f->>'object') from jsonb_array_elements(coalesce(m.metadata->'categorisation'->'furnishings','[]'::jsonb)) f),'[]'::jsonb)||jsonb_build_array(case when m.metadata->'categorisation'->>'hasTelevision'='true' then 'Television' end,case when m.metadata->'categorisation'->>'hasComputer'='true' then 'Computer' end)) label
 where i.eligible and lower(trim(i.category)) not in ('exterior','floorplan','floor plan','other','uncategorised','uncategorized','unknown','interior','infographic','illustration','promotional graphic','marketing image','document','logo','map')
 and nullif(trim(label),'') is not null
 ) select name,count(distinct uid)::int as count,min('/api/assets/'||builder_slug||'/'||path) as image from items where name !~* $1 and name not in ('none','unknown','not applicable') group by name order by name`,[colourPattern]);
 return rows.map(row=>({name:String(row.name).replace(/\b\w/g,c=>c.toUpperCase()),slug:encodeURIComponent(String(row.name)),count:Number(row.count),image:String(row.image)}));
}
export const readFurnishings=cache(async()=>{
 const sql=websiteDatabase(),key='furnishings:items:v2';
 const [row]=await sql`select r.revision,c.payload from showhome_web.publication_revision r left join showhome_web.query_cache c on c.key=${key} and c.revision=r.revision where r.singleton=true`;
 if(row?.payload)return row.payload as Furnishing[];
 const items=await queryFurnishings(sql);
 await cacheWrite(()=>sql`insert into showhome_web.query_cache(key,revision,expires_at,payload) select ${key},revision,'infinity'::timestamptz,${sql.json(items as never)} from showhome_web.publication_revision where singleton=true and revision=${row!.revision} on conflict(key) do update set revision=excluded.revision,expires_at=excluded.expires_at,payload=excluded.payload`);
 return items;
});
