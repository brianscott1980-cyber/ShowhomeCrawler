import {cacheWrite} from './cache-write';
import type postgres from 'postgres';
import {createHash} from 'node:crypto';
import {websiteDatabase} from './website';
import {queryDirectory} from './directory-query';
import type {DirectoryRequest,DirectoryPageData} from '../web/directory-page-data';
import {milesBetween as distanceMiles} from '../web/site-filters';
const allowed=['developer','region','radius','order','bedrooms','location','site','type','building','minBeds','maxBeds','minPrice','maxPrice'];
export async function cachedDirectory(input:DirectoryRequest,sql:postgres.Sql=websiteDatabase(),query:(input:DirectoryRequest)=>Promise<DirectoryPageData>=(input)=>queryDirectory(input,sql)):Promise<DirectoryPageData>{
 const personal=Boolean(input.keys!==undefined||input.selectedKey||input.point&&(input.filters?.radius||input.filters?.order==='distance'));
 if(personal)return query(input);
 const filters=Object.fromEntries(allowed.filter(k=>input.filters?.[k]).sort().map(k=>[k,input.filters![k]!]));
 const shared={kind:input.kind,filters,offset:input.offset??0,limit:input.limit??16};
 const key=createHash('sha256').update(JSON.stringify({...shared,visibility:"ready-developments-and-buildings-v6"})).digest('hex');
 const [row]=await sql`select r.revision,c.payload from showhome_web.publication_revision r left join showhome_web.query_cache c on c.key=${key} and c.revision=r.revision and c.expires_at>now() where r.singleton=true`;
 let data=row?.payload as DirectoryPageData|undefined;
 if(!data){data=await query(shared);await cacheWrite(()=>sql`insert into showhome_web.query_cache(key,revision,expires_at,payload) select ${key},revision,now()+interval '5 minutes',${sql.json(data as never)} from showhome_web.publication_revision where singleton=true and revision=${row!.revision} on conflict(key) do update set revision=excluded.revision,expires_at=excluded.expires_at,payload=excluded.payload`);}
 const labels={builders:['Builders','Developments','Building types'],locations:['Developments'],buildings:['Styles','Developments'],interiors:['Room types','Interiors']}[input.kind];
 data={...data,counts:Object.fromEntries(labels.map(label=>[label,data!.counts[label]!]))};
 if(input.point&&input.kind==='locations')return {...data,cards:data.cards.map(card=>({...card,miles:Number.isFinite(card.latitude)&&Number.isFinite(card.longitude)?distanceMiles(input.point!,{latitude:card.latitude,longitude:card.longitude}):null}))};
 return data;
}
