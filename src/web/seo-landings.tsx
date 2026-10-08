import {cache} from 'react';
import {notFound} from 'next/navigation';
import {readWebsiteBuilder,findDirectoryReference} from '../database/website';
import {cachedDirectory} from '../database/directory-cache';
import {cachedGallery} from '../database/gallery-cache';
import {selectionValue} from './filter-selection';
import {landingColours,colourLabels,colourRoomTitle} from './seo-landing-values';
import {FixedPageFilters} from './fixed-page-filters';
import {GroupDirectory} from './group-pages';
import {ResultsPage} from './results-page';
import {searchListing} from './seo';
import type {GalleryScope} from './gallery-page-data';

export const seoLanding=cache(async(path:string)=>{
 const parts=path.split('/').filter(Boolean),[kind,slug,colour]=parts;
 if((kind==='interiors'||slug==='interiors')&&(parts.length===2||parts.length===3)){
  const builder=await readWebsiteBuilder((kind==='interiors'?slug:kind)!.toLowerCase());
  if(builder){
  const fixedFilters={developer:builder.name},basePath=`/interiors/${builder.slug}`;
  if(parts.length===2){
   const initial=await cachedDirectory({kind:'interiors',filters:fixedFilters,fixedFilters});
   const title=`${builder.name} Interiors`,description=`Explore ${builder.name} showhome interiors by room. Discover kitchens, bedrooms, bathrooms and ideas for your home.`;
   return {type:'directory' as const,kind:'interiors' as const,fixedFilters,initial,title,description,path:basePath,linkBase:basePath};
  }
  const room=colour!.toLowerCase(),href=`/interiors/${room}`;
  const reference=room==='all'?{name:'All Room Types'}:await findDirectoryReference('interiors',href);
  if(!reference)return null;
  const scope:GalleryScope={kind:'interiors',href,fixedFilters};
  const initial=await cachedGallery({scope,filters:fixedFilters});
  if(!initial.total)notFound();
  const title=`${builder.name} ${room==='all'?'Interiors':reference.name}`,description=`Explore ${title.toLowerCase()} from real showhomes. Discover ideas, colours and furnishings for your home.`;
  return {type:'gallery' as const,fixedFilters,scope,initial,title,description,path:`${basePath}/${room}`,back:basePath,backLabel:`← ${builder.name} Interiors`};
  }
 }
 if((kind==='developments'||kind==='buildings')&&parts.length===2){
  const builder=await readWebsiteBuilder(slug!.toLowerCase());
  if(!builder)return null;
  const fixedFilters={developer:builder.name},directoryKind=kind==='developments'?'locations' as const:'buildings' as const;
  const initial=await cachedDirectory({kind:directoryKind,filters:fixedFilters,fixedFilters});
  if(!initial.total)notFound();
  const title=`${builder.name} ${kind==='developments'?'Developments':'Building Types'}`;
  const description=kind==='developments'?`Explore ${builder.name} new build developments across the UK. Discover their locations, compare house types and view showhome interiors for your next home.`:`Compare ${builder.name} building types and house layouts. Explore exterior photographs, available floorplans and showhome interiors to find the home and ideas you love.`;
  return {type:'directory' as const,kind:directoryKind,fixedFilters,initial,title,description,path:`/${kind}/${builder.slug}`};
 }
 if(kind==='interiors'&&parts.length===3&&landingColours.includes(colour!.toLowerCase() as typeof landingColours[number])){
  const href=`/interiors/${slug!.toLowerCase()}`,reference=await findDirectoryReference('interiors',href);
  if(!reference||['exterior','floorplan','uncategorised'].includes(reference.name.toLowerCase()))return null;
  const base=await cachedGallery({scope:{kind:'interiors',href}});
  const labels=colourLabels(colour!.toLowerCase(),base.facets.colour??[]);
  if(!labels.length)notFound();
  const fixedFilters={colour:selectionValue(labels)},scope:GalleryScope={kind:'interiors',href,fixedFilters};
  const initial=await cachedGallery({scope,filters:fixedFilters});
  if(!initial.total)notFound();
  const title=colourRoomTitle(colour!.toLowerCase(),reference.name),description=`Explore ${title.toLowerCase()} from real UK showhomes. Compare colour schemes, furnishings and decorative features, and save inspiration for your own home.`;
  return {type:'gallery' as const,fixedFilters,scope,initial,title,description,path:`${href}/${colour!.toLowerCase()}`,back:href};
 }
 return null;
});
export async function seoLandingMetadata(path:string){const landing=await seoLanding(path);return landing?searchListing(landing.title,landing.description,landing.path):null;}
export function SeoLandingPage({landing}:{landing:NonNullable<Awaited<ReturnType<typeof seoLanding>>>}){
 return <FixedPageFilters filters={landing.fixedFilters}>{landing.type==='directory'?<GroupDirectory kind={landing.kind} initial={landing.initial} title={landing.title} description={landing.description} linkBase={'linkBase' in landing?landing.linkBase:undefined}/>:<ResultsPage title={landing.title} description={landing.description} eyebrow={null} collections={[]} places={{}} galleryScope={landing.scope} galleryPage={landing.initial} back={{href:landing.back,label:('backLabel' in landing?landing.backLabel:undefined)??'← All '+landing.title.split(' ').slice(1).join(' ')}} includeUnclassified/>}</FixedPageFilters>;
}
