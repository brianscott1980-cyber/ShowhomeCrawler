import {load} from 'cheerio';
import type {PropertyCandidate,GalleryImageCandidate} from '../../models/domain.js';
const origin='https://www.dandara.com';
export function developmentUrls(xml:string){
 const $=load(xml,{xml:true});
 return [...new Set($('url > loc').map((_,e)=>$(e).text().trim()).get().filter(value=>{
  const url=new URL(value),parts=url.pathname.split('/').filter(Boolean);
  return url.origin===origin&&parts.length===4&&parts[0]==='new-homes-for-sale';
 }))];
}
export function discoverHomes(html:string,url:string){
 const $=load(html),pathname=new URL(url).pathname.replace(/\/$/,'')+'/';
 const canonical=$('link[rel=canonical]').attr('href');
 if(!$('#vue-search-results').attr('data-dev-id')||(canonical&&new URL(canonical).pathname!==new URL(url).pathname))throw new Error('Retired or redirected development URL');
 const name=$('h1').first().clone().children('span').remove().end().text().replace(/\s+/g,' ').replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/,'').trim();
 if(!name)throw new Error('Missing development heading');
 const homes=new Map<string,PropertyCandidate>();
 $('a[href]').each((_,e)=>{
  const target=new URL($(e).attr('href')!,origin);
  if(target.origin!==origin||!target.pathname.startsWith(pathname)||target.pathname.slice(pathname.length).split('/').filter(Boolean).length!==1||target.hash)return;
  const card=$(e).closest('article,.search-results__result'),text=card.text().replace(/\s+/g,' ').trim();
  const title=card.find('h3').first().clone();title.find('span').remove();
  const house=title.text().trim()||$(e).text().trim();if(!house)return;
  homes.set(target.href,{externalId:target.pathname,name:house,url:target.href,bedrooms:Number(text.match(/(\d+)\s*bedrooms?/i)?.[1])||null,price:Number(text.match(/£\s*([\d,]+)/)?.[1]?.replaceAll(',',''))||null,propertyType:/apartment/i.test(text)?'apartment':'house',isDetached:/semi[ -]?detached/i.test(text)?false:/\bdetached\b/i.test(text)?true:null,available:!/reserved|sold/i.test(text),status:/reserved/i.test(text)?'reserved':'advertised'});
 });
 const plots=[...homes.values()];
 return {development:{name,url},plots,homes:[...plots,{externalId:pathname,name:`${name} development gallery`,url,bedrooms:null,price:null,propertyType:'development',isDetached:null,available:false,status:'published gallery'}],plotError:null};
}
export function galleryImages(html:string):GalleryImageCandidate[]{
 const $=load(html),images=new Map<string,GalleryImageCandidate>();
 $('.gallery img,.module__gallery img,.module__floorplans img,.module__floorplan img,.banner-header__images img').each((_,e)=>{
  const raw=$(e).attr('data-src')||$(e).attr('src');if(!raw||raw.startsWith('data:'))return;
  const url=new URL(raw,origin);if(url.origin!==origin||!url.pathname.startsWith('/assets/'))return;
  images.set(url.href,{url:url.href,position:images.size,altText:$(e).attr('alt')});
 });
 return [...images.values()];
}
