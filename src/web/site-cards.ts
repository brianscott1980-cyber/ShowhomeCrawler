import {developmentCardImageCollection,reportCardImage} from './card-images';
import {readLocationRows} from './location-geography';
import {collectionFolder} from './collections';
import {readFile} from 'node:fs/promises';
import type {Group} from './groups';
import {groupRoutes} from './group-routes';
import type {SiteCard,SiteProperty} from './site-filters';

export async function siteCards(groups:Group[]):Promise<SiteCard[]>{
 const routes=groupRoutes('locations',groups);
 const slugs=[...new Set(groups.flatMap(g=>g.collections.map(c=>c.slug)))];
 const data=new Map(await Promise.all(slugs.map(async slug=>{
  const [locations,details]=await Promise.all([readLocationRows(slug),readFile(`${collectionFolder(slug)}/site-details.json`,'utf8').then(s=>JSON.parse(s)).catch(()=>[])]);
  return [slug,{locations:locations as {url:string;latitude?:number;longitude?:number;geography?:{region?:string;country?:string}}[],details:details as {url:string;country:string|null;scope?:string;properties:SiteProperty[]}[]}] as const;
 })));
 return groups.map(group=>{const c=group.collections[0]!,url=group.developmentUrl??c.report.properties[0]?.developmentUrl,metadata=data.get(c.slug),location=metadata?.locations.find(l=>l.url===url),detail=metadata?.details.find(d=>d.url===url);return {key:group.key,href:routes.get(group.key)!,name:group.name,developer:c.name,...developmentCardImageCollection(group.collections.flatMap(c=>c.report.images.map(i=>reportCardImage(c.slug,i)))),count:group.count,country:detail?.country??location?.geography?.country??null,region:location?.geography?.region??location?.geography?.country??detail?.country??null,latitude:location?.latitude,longitude:location?.longitude,propertyScope:detail?.scope,properties:detail?.properties??c.report.properties.map(p=>({price:p.price,bedrooms:p.bedrooms,style:null}))};});
}


