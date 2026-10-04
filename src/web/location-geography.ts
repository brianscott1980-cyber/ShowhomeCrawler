import {readFile} from 'node:fs/promises';
export interface LocationRow {name:string;url:string;postcode?:string;latitude?:number;longitude?:number;geography?:Record<string,string|null>}
export async function readLocationRows(slug:string):Promise<LocationRow[]>{
 const [rows,index]=await Promise.all([
  readFile(`collections/${slug}-home-offices/locations.json`,'utf8').then(s=>JSON.parse(s) as LocationRow[]).catch(()=>[]),
  readFile('collections/location-geography.json','utf8').then(s=>JSON.parse(s) as Record<string,{postcode?:string;latitude?:number;longitude?:number;geography:Record<string,string|null>}>).catch(()=>({} as Record<string,{postcode?:string;latitude?:number;longitude?:number;geography:Record<string,string|null>}>)),
 ]);
 return rows.map(row=>{const entry=index[`${slug}:${row.url}`];const current=entry&&entry.postcode===row.postcode&&entry.latitude===row.latitude&&entry.longitude===row.longitude;return {...row,geography:{...(current?entry.geography:{}),...row.geography}};});
}
