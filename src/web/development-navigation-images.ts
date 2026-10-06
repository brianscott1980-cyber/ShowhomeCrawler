import {isCategorisedImage} from './image-classification';
import type {ReportImage,RunReport} from '../reports/report';
import {homeTypeName} from '../reports/home-display';
type Collection={slug:string;report:RunReport};
/** Previews must belong to a property at this development, never another builder/site. */
export function developmentNavigationImages(collections:Collection[],builderSlug:string,developmentUrl?:string){
 const candidates=collections.filter(collection=>collection.slug===builderSlug).flatMap(collection=>{
  const homes=collection.report.properties.filter(home=>home.developmentUrl===developmentUrl);
  const buildingIds=new Set(homes.filter(home=>homeTypeName(home.name)!=='Development gallery').flatMap(home=>home.imageIds));
  const siteIds=new Set(homes.flatMap(home=>home.imageIds));
  return collection.report.images.filter(image=>siteIds.has(image.id)&&isCategorisedImage(image)).map(image=>({image,slug:collection.slug,building:buildingIds.has(image.id)}));
 });
 const siteSlug=developmentUrl?.split('/').filter(Boolean).at(-1)?.toLowerCase()??'';
 const belongsToSitePath=(image:ReportImage)=>Boolean(siteSlug)&&image.sourceUrl?.toLowerCase().split('/').includes(siteSlug);
 const category=(image:ReportImage)=>(image.categorisation?.mainCategory??image.verdict?.roomType??'').trim().replace(/[_-]/g,' ');
 const isExterior=(image:ReportImage)=>/^exterior(?:\s|$)|^front elevation$|^facade$/i.test(category(image))||(!category(image)&&/\/CGIs?\//i.test(image.sourceUrl??''));
 const isInterior=(image:ReportImage)=>!isExterior(image)&&! /^(?:other|uncategorised|floor ?plan|site plan|garden|patio|balcony|logo|graphic|map)$/i.test(category(image))&&Boolean(category(image))&&(image.categorisation?image.categorisation.isRoom:image.verdict?.matches);
 const exteriors=candidates.filter(candidate=>candidate.building&&isExterior(candidate.image));
 const exterior=exteriors.find(({image})=>/\bfront\b|fa[cç]ade|street[- ]facing/i.test(`${image.categorisation?.subCategory??''} ${image.verdict?.description??''}`))??exteriors[0];
 const interior=candidates.find(candidate=>isInterior(candidate.image));
 const siteExterior=exteriors.find(({image})=>belongsToSitePath(image));
 return {exterior:siteExterior??exterior,interior};
}
