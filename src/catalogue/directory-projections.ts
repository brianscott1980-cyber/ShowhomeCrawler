import {directoryPreview,directoryIdentityEncoder,compactDirectoryPlaces} from '../web/directory-payload';
import {groupRoutes} from '../web/group-routes';
import {groupCollections,readGroups,spaceName,type GroupKind,type Collection} from '../web/groups';
import {buildingLocationIndex} from '../web/building-locations';
import {developmentName} from '../web/development-name';
import {siteCards} from '../web/site-cards';
import {cardImageCollection,buildingCardImageCollection,reportCardImage} from '../web/card-images';
import {builderFacts} from '../web/builder-facts';
import {builderLogoBackground} from '../web/builder-brand';
import {homeTypeName} from '../reports/home-display';
import {developers,readCollection} from '../web/collections';
import {readLocationRows} from '../web/location-geography';
import type {DeveloperCard} from '../web/directory';
import {readWebsiteBuilder} from '../database/website';
export async function groupDirectoryData(kind:GroupKind,loaded?:Collection[]){
 const groups=loaded?groupCollections(loaded,kind):await readGroups(kind),routes=groupRoutes(kind,groups);
 const references=groups.map(group=>({key:group.key,slugs:group.collections.map(c=>c.slug),builderSlug:group.collections.length===1?group.collections[0]!.slug:null,developmentUrl:group.developmentUrl??null,buildingName:kind==='buildings'?group.name.toLowerCase():null,category:kind==='interiors'?group.name:null}));
 if(kind==='locations'||kind==='sites'){const cards=await siteCards(groups);return {cards,counts:{Developments:cards.length},references};}
 const geography=await buildingLocationIndex(groups);
 const encodeIdentity=directoryIdentityEncoder();
 const cards=groups.map(group=>{
  const properties=group.collections.flatMap(c=>c.report.properties??[]);
  const bedrooms=[...new Set(properties.map(p=>p.bedrooms).filter((b):b is number=>typeof b==='number'&&Number.isFinite(b)))].sort((a,b)=>a-b);
  const sites=[...new Set(properties.map(p=>p.development?developmentName(p.development):undefined).filter((d):d is string=>Boolean(d)))].sort();
  const interiorIds:string[]=[];
  const places=compactDirectoryPlaces(group.collections.flatMap(c=>{
   const roomIds=new Set(c.report.images.filter(image=>image.categorisation?image.categorisation.isRoom:Boolean(image.verdict?.matches)&&spaceName(image,c.report.question)!=='Exterior').map(image=>image.id));
   interiorIds.push(...[...roomIds].map(id=>encodeIdentity(`${c.slug}:${id}`)));
   return c.report.properties.map(p=>({site:developmentName(p.development),siteId:`${c.slug}:${p.developmentUrl}`,imageIds:[...new Set(p.imageIds)].filter(id=>roomIds.has(id)).map(id=>encodeIdentity(`${c.slug}:${id}`)),developer:c.name,bedrooms:p.bedrooms,locations:geography.get(`${c.slug}:${p.developmentUrl}`)??[]}));
  }));
  const locations=[...new Set(places.flatMap(p=>p.locations))].sort();
  const previews=(kind==='buildings'?buildingCardImageCollection:cardImageCollection)(group.collections.flatMap(c=>c.report.images.map(i=>reportCardImage(c.slug,i))));
  return {key:group.key,href:routes.get(group.key)!,name:group.name,interiorIds,developers:[...new Set(group.developers)],count:group.count,...directoryPreview(previews),bedrooms,locations,sites,places};
 });
 const isBuildings=kind==='buildings';
 const locationCount=new Set(groups.flatMap(group=>group.collections.flatMap(c=>c.report.properties.filter(p=>p.developmentUrl).map(p=>`${c.slug}:${p.developmentUrl}`)))).size;
 const roomGroups=groups.filter(group=>!['Exterior','Uncategorised'].includes(group.name));
 const interiorCount=new Set(roomGroups.flatMap(group=>group.collections.flatMap(c=>c.report.images.filter(image=>image.categorisation?image.categorisation.isRoom:Boolean(image.verdict?.matches)&&spaceName(image,c.report.question)!=='Exterior').map(image=>`${c.slug}:${image.id}`)))).size;
 return {cards,counts:isBuildings?{Styles:groups.length,Developments:locationCount}:{'Room types':roomGroups.length,Interiors:interiorCount},references};
}

export async function builderDirectoryData(loaded?:Collection[]){
 const reports:Collection[]=[];
 const cards=await Promise.all(developers.map(async developer=>{
  const report=loaded?loaded.find(c=>c.slug===developer.slug)?.report:await readCollection(developer.slug);if(!report)return null;const matches=report?.images.filter(i=>i.categorisation?(i.categorisation.isRoom||i.categorisation.mainCategory==='Exterior'):i.verdict?.matches)??[];const hero=matches[0];if(!hero)return null;reports.push({slug:developer.slug,name:developer.name,report});
  const locations=await readLocationRows(developer.slug);
  const publishedLocations=new Set(groupCollections([{slug:developer.slug,name:developer.name,report}],'locations').flatMap(group=>group.collections.flatMap(collection=>collection.report.properties.map(home=>home.developmentUrl))));
  const brand=await readWebsiteBuilder(developer.slug);
  const logoUrl=brand?.logo_url??undefined;
  const logoBackground=brand?.logo_background??'#fff';
  return {...await builderFacts(developer.slug),slug:developer.slug,name:developer.name,spaces:matches.length,logo:logoUrl,
   ...directoryPreview(cardImageCollection(matches.map(i=>reportCardImage(developer.slug,i)),logoUrl?{src:logoUrl,alt:`${developer.name} logo`,kind:'logo',background:logoBackground}:undefined)),locations:locations.filter(p=>publishedLocations.has(p.url)).map(p=>({...p,key:`${developer.slug}:${p.url}`,region:p.geography?.region||p.geography?.country||'Unknown',buildingTypes:[...new Set(report.properties.filter(home=>home.developmentUrl===p.url).map(home=>homeTypeName(home.name).toLowerCase()))]}))} as DeveloperCard;
 }));
 const collections=cards.filter((c):c is DeveloperCard=>c!==null);
 const locationCount=groupCollections(reports,'locations').length;
 const buildingTypeCount=groupCollections(reports,'buildings').length;
 return {cards:collections,counts:{Builders:collections.length,Developments:locationCount,'Building types':buildingTypeCount}};
}
