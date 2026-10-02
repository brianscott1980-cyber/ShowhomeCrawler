import {readFile} from 'node:fs/promises';
import type {Group} from './groups';

export async function buildingLocationIndex(groups:Group[]){
 const slugs=[...new Set(groups.flatMap(g=>g.collections.map(c=>c.slug)))];
 const index=new Map<string,string[]>();
 await Promise.all(slugs.map(async slug=>{
  const rows=await readFile(`collections/${slug}-home-offices/locations.json`,'utf8').then(s=>JSON.parse(s) as {url:string;geography?:Record<string,string|null>}[]).catch(()=>[]);
  for(const row of rows)index.set(`${slug}:${row.url}`,[...new Set(Object.values(row.geography??{}).filter((v):v is string=>Boolean(v)))]);
 }));
 return index;
}
