import {load} from 'cheerio';
import type {PropertyCandidate,GalleryImageCandidate} from '../../models/domain.js';
export function createPublicGalleryParser(config:{origin:string;developmentPattern:RegExp;homePattern:RegExp;mediaPattern:RegExp;headingSelector?:string;gallerySelector?:string}){
 const {origin}=config;
 function developmentUrls(xml:string){const $=load(xml,{xml:true}),urls=new Set<string>();$('url > loc,a[href]').each((_,e)=>{const raw=$(e).attr('href')||$(e).text().trim();if(!raw)return;const url=new URL(raw,origin);if(url.origin!==origin||!config.developmentPattern.test(url.pathname))return;url.hash='';urls.add(url.href);});return [...urls];}
 function discoverHomes(html:string,url:string){
  const $=load(html);$('header,footer,nav,.mobile-nav,.site-header,.site-footer').remove();
  const heading=$(config.headingSelector??'h1').first().text().replace(/\s+/g,' ').replace(/\s[|–-]\s[^|]+$/,'').trim();
  if(!heading)throw new Error('Missing development heading');
  const homes=new Map<string,PropertyCandidate>();
  $('a[href]').each((_,e)=>{
   const link=$(e),target=new URL(link.attr('href')!,origin);if(target.origin!==origin||!config.homePattern.test(target.pathname))return;target.hash='';
   const card=link.closest('article,.card-with-media,.uk-card,tr,.property-card,.card,.panel__card,.plot,.plot-card,.house-type,.property_development_plot_stub_item,.search-results__result');
   const text=(card.length?card.clone().find('*').append(' ').end().text():link.parent().text()).replace(/\s+/g,' ').trim();
   const name=(card.find('h2,h3,h4,.house-name,.plot_name').first().text()||link.text()).replace(/\s+/g,' ').trim();if(!name)return;
   homes.set(target.href,{externalId:target.pathname,name,url:target.href,bedrooms:Number(text.match(/(\d+)\s*(?:bedrooms?|beds?)/i)?.[1])||null,price:Number(text.match(/£\s*([\d,]+)/)?.[1]?.replaceAll(',',''))||null,propertyType:/apartment|flat/i.test(text)?'apartment':'house',isDetached:/semi[ -]?detached/i.test(text)?false:/\bdetached\b/i.test(text)?true:null,available:!/sold|reserved/i.test(text),status:/sold|reserved/i.test(text)?'reserved':'advertised'});
  });
  const plots=[...homes.values()];
  return {development:{name:heading,url},plots,homes:[...plots,{externalId:new URL(url).pathname,name:`${heading} development gallery`,url,bedrooms:null,price:null,propertyType:'development',isDetached:null,available:false,status:'published gallery'}],plotError:null};
 }
 function galleryImages(html:string):GalleryImageCandidate[]{
  const $=load(html);$('header,footer,nav,.mobile-nav,.site-header,.site-footer,.related-posts,.news-list').remove();
  const images=new Map<string,GalleryImageCandidate>();
  const add=(raw:string|undefined,alt?:string)=>{if(!raw||raw.startsWith('data:'))return;let url:URL;try{url=new URL(raw,origin);}catch{return;}if(url.origin!==origin||!config.mediaPattern.test(url.pathname))return;url.hash='';if(!images.has(url.href))images.set(url.href,{url:url.href,position:images.size,altText:alt});};
  const root=config.gallerySelector?$(config.gallerySelector):$('body');
  root.find('img').each((_,e)=>{const image=$(e);add(image.attr('data-img')||image.attr('data-lazy-src')||image.attr('data-lazy')||image.attr('data-src')||image.attr('src'),image.attr('alt'));});
  root.find('a[href]').each((_,e)=>{const raw=$(e).attr('href');if(raw&&/\.(?:jpe?g|png|webp|avif|svg)(?:\?|$)/i.test(raw))add(raw,$(e).find('img').attr('alt'));});
  root.find('[style],[data-bg],[data-lazy-background]').each((_,e)=>{const raw=$(e).attr('data-bg')||$(e).attr('data-lazy-background')||$(e).attr('style')?.match(/url\(\s*['"]?([^'"\)]+)['"]?\s*\)/)?.[1];add(raw);});
  return [...images.values()];
 }
 async function enrichPage(html:string){
  const $=load(html);
  for(const e of $('iframe[src],iframe[data-lazy-src]').toArray()){
   const raw=$(e).attr('data-lazy-src')||$(e).attr('src')||'';if(!/https:\/\/(?:www\.)?google\.com\/maps/.test(raw))continue;
   const point=raw.match(/!2d(-?\d+\.\d+)!3d(-?\d+\.\d+)/);
   const lat=Number(point?.[2]),lon=Number(point?.[1]);
   if(lat>=49&&lat<=61.2&&lon>=-9&&lon<=3){$('body').append(`<script type="application/ld+json">${JSON.stringify({'@type':'Place',geo:{latitude:lat,longitude:lon}})}</script>`);break;}
  }
  return $.html();
 }
 return {developmentUrls,discoverHomes,galleryImages,enrichPage};
}
