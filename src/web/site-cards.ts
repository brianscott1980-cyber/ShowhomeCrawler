import {directoryPreview} from './directory-payload';
import {developmentCardImageCollection,reportCardImage} from './card-images';
import {readLocationRows} from './location-geography';
import {readWebsiteOffers,readWebsiteBuilder} from '../database/website';
import type {Group} from './groups';
import {groupRoutes} from './group-routes';
import type {SiteCard,SiteProperty} from './site-filters';

export async function siteCards(groups:Group[]):Promise<SiteCard[]>{
 const routes=groupRoutes('locations',groups);
 const slugs=[...new Set(groups.flatMap(g=>g.collections.map(c=>c.slug)))];
 const data=new Map(await Promise.all(slugs.map(async slug=>{
  const [locations,details,brand]=await Promise.all([readLocationRows(slug),readWebsiteOffers(slug),readWebsiteBuilder(slug)]);
  return [slug,{logo:brand?.logo_url??undefined,logoBackground:brand?.logo_background??'#fff',locations:locations as {url:string;town?:string|null;country?:string|null;latitude?:number;longitude?:number;geography?:{region?:string;country?:string}}[],details:details as {url:string;country:string|null;scope?:string;properties:SiteProperty[]}[]}] as const;
 })));
 return groups.map(group=>{const c=group.collections[0]!,url=group.developmentUrl??c.report.properties[0]?.developmentUrl,metadata=data.get(c.slug),location=metadata?.locations.find(l=>l.url===url),detail=metadata?.details.find(d=>d.url===url);return {key:group.key,href:routes.get(group.key)!,name:group.name,developer:c.name,logo:metadata?.logo,logoBackground:metadata?.logoBackground,...directoryPreview(developmentCardImageCollection(group.collections.flatMap(c=>c.report.images.map(i=>reportCardImage(c.slug,i))))),count:group.count,town:location?.town??null,country:location?.country??detail?.country??location?.geography?.country??null,region:location?.geography?.region??location?.geography?.country??detail?.country??null,latitude:location?.latitude,longitude:location?.longitude,propertyScope:detail?.scope,properties:detail?.properties??c.report.properties.map(p=>({price:p.price,bedrooms:p.bedrooms,style:null}))};});
}


