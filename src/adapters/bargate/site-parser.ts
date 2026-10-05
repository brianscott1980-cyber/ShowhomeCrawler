import {load} from 'cheerio';
import {createPublicGalleryParser} from '../shared/public-gallery-parser.js';
import type {GalleryImageCandidate} from '../../models/domain.js';
const origin='https://www.bargatehomes.co.uk';
const parser=createPublicGalleryParser({origin,developmentPattern:/^\/developments\/[^/]+\/$/,homePattern:/^\/house-type\/[^/]+\/$/,mediaPattern:/^\/app\/uploads\//});
export const {developmentUrls,enrichPage}=parser;
export function discoverHomes(html:string,url:string){
 const $=load(html),heading=$('h1').first().text().trim();
 // Bargate places the development title in a header that the shared parser strips.
 if(heading)$('body').prepend($('<h1>').text(heading));
 const result=parser.discoverHomes($.html(),url);
 for(const home of result.homes){
  if(!home.url.includes('/house-type/'))continue;
  const slug=new URL(home.url).pathname.split('/').filter(Boolean).at(-1)!;
  home.name=slug.replace(/-(?:house|flat|apartment)(?:-.*)?$/,'').split('-').map(word=>word[0]!.toUpperCase()+word.slice(1)).join(' ');
 }
 return result;
}
/** Only the property's own media carousel; exclude site chrome and recommended homes. */
export function galleryImages(html:string):GalleryImageCandidate[]{
 const $=load(html),images=new Map<string,GalleryImageCandidate>();
 $('.wp-block-bargate-homes-media-carousel').find('img').each((_,element)=>{
  const image=$(element),raw=image.attr('data-src')||image.attr('src');if(!raw)return;
  let url:URL;try{url=new URL(raw,origin);}catch{return;}
  if(!['cdn.bargatehomes.co.uk','www.bargatehomes.co.uk','housebuilderpro.blob.core.windows.net'].includes(url.hostname)||!/^https:$/.test(url.protocol)||! /\.(?:jpe?g|png|webp|avif)$/i.test(url.pathname))return;
  if(!images.has(url.href))images.set(url.href,{url:url.href,position:images.size,altText:image.attr('alt')});
 });
 return [...images.values()];
}
