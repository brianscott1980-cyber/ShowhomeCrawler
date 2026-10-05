import {developmentName} from './development-name';
import {readFile} from 'node:fs/promises';
export interface LocationRow {name:string;url:string;town?:string|null;country?:string|null;postcode?:string;latitude?:number;longitude?:number;geography?:Record<string,string|null>}
export async function readLocationRows(slug:string):Promise<LocationRow[]>{
 const [rows,index,places]=await Promise.all([
  readFile(`collections/${slug}-home-offices/locations.json`,'utf8').then(s=>JSON.parse(s) as LocationRow[]).catch(()=>[]),
  readFile('collections/location-geography.json','utf8').then(s=>JSON.parse(s) as Record<string,{postcode?:string;latitude?:number;longitude?:number;geography:Record<string,string|null>}>).catch(()=>({} as Record<string,{postcode?:string;latitude?:number;longitude?:number;geography:Record<string,string|null>}>)),
  readFile('collections/development-places.json','utf8').then(s=>JSON.parse(s) as Record<string,LocationRow>).catch(()=>({} as Record<string,LocationRow>)),
 ]);
 const combined=new Map(rows.map(row=>[row.url,row]));
 for(const [key,place] of Object.entries(places))if(key.startsWith(slug+':'))combined.set(place.url,{...combined.get(place.url),...place});
 return [...combined.values()].map(row=>{const entry=index[`${slug}:${row.url}`];const current=entry&&entry.postcode===row.postcode&&entry.latitude===row.latitude&&entry.longitude===row.longitude;return {...row,name:developmentName(row.name),geography:{...(current?entry.geography:{}),...row.geography}};});
}
