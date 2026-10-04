import {readLocationRows} from './location-geography';
import type {Group} from './groups';

export async function buildingLocationIndex(groups:Group[]){
 const slugs=[...new Set(groups.flatMap(g=>g.collections.map(c=>c.slug)))];
 const index=new Map<string,string[]>();
 await Promise.all(slugs.map(async slug=>{
  const rows=await readLocationRows(slug);
  for(const row of rows)index.set(`${slug}:${row.url}`,[...new Set(Object.values(row.geography??{}).filter((v):v is string=>Boolean(v)))]);
 }));
 return index;
}
