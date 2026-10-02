import { load } from 'cheerio';
import type { PropertyCandidate, GalleryImageCandidate } from '../../models/domain.js';
export function developmentUrls(xml:string):string[] {
 const $=load(xml,{xmlMode:true}); const sites=new Set<string>();
 $('url > loc').each((_,el)=>{const url=new URL($(el).text().trim()); const parts=url.pathname.split('/').filter(Boolean); if(url.origin==='https://www.cala.co.uk' && parts[0]==='homes-for-sale' && parts.length>=4) sites.add(url.origin+'/'+parts.slice(0,4).join('/')+'/availability-prices/');}); return [...sites];
}
export function discoverHomes(html:string,url:string){
 const $=load(html); const name=$('h1').first().text().trim(); if(!name) throw new Error('Unexpected development page.');
 const plots:PropertyCandidate[]=[];
 $('#plot-list > [data-bedrooms]').each((_,el)=>{const card=$(el); const title=card.find('h3').text().trim(); const plot=title.match(/Plot\s+(\S+)\s*[-–:]\s*(.+)/i); const href=card.find('a').toArray().map(a=>$(a).attr('href')).find(h=>h && /\/[^/]+\/\d+\/$/.test(h)); if(!href && !plot?.[1]) return;
 const linked=new URL(href ?? url.replace(/availability-prices\/$/, '') + encodeURIComponent(plot![1]!) + '/',url); if(linked.origin!=='https://www.cala.co.uk') throw new Error('Unexpected plot host.');
 plots.push({externalId:'plot:'+linked.pathname,houseTypeExternalId:(plot?.[2]??title).toLowerCase().replace(/\W+/g,'-'),name:plot?.[2]??title,url:linked.href,plotNumber:plot?.[1],bedrooms:Number(card.attr('data-bedrooms')),price:Number(card.attr('data-price'))||null,propertyType:card.attr('data-housetype')??null,isDetached:card.attr('data-housetype')?.toLowerCase()==='detached',available:card.attr('data-reserved')!=='true',status:card.attr('data-reserved')==='true'?'reserved':'available'});
 });
 return {development:{name,url},plots,homes:plots,plotError:null};
}
export function galleryImages(html:string):GalleryImageCandidate[]{
 const $=load(html); const images=new Map<string,GalleryImageCandidate>();
 $('.plot-gallery img, a[data-fancybox="calagallery"]').each((_,el)=>{const raw=$(el).attr('href')??$(el).attr('src'); if(!raw)return; const url=new URL(raw,'https://www.cala.co.uk'); if(url.origin!=='https://www.cala.co.uk'||!url.pathname.startsWith('/media/'))throw new Error('Unexpected gallery host.'); url.search=''; images.set(url.href,{url:url.href,position:images.size,altText:$(el).attr('alt')});});return [...images.values()];
}
