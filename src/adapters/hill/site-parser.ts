import {load} from 'cheerio';
import type {PropertyCandidate,GalleryImageCandidate} from '../../models/domain.js';
const origin='https://www.hill.co.uk';
export function developmentUrls(html:string){const $=load(html);const raw=$('script[type="application/json"]').first().text();const data=JSON.parse(raw).hgpSearch as {developments?:{url:string}[]};if(!Array.isArray(data?.developments))throw new Error('Missing public development index');return [...new Set(data.developments.map(d=>{const url=new URL(d.url,origin);if(url.origin!==origin)throw new Error('Unexpected development origin');return url.href;}))] as string[];}
export function discoverHomes(html:string,url:string){const $=load(html);const name=$('h1').first().text().trim();if(!name)throw new Error('Missing development heading');const plots:PropertyCandidate[]=[];const seen=new Set<string>();$('tr.available-home-row').each((_,e)=>{const a=$(e),href=a.find('.views-field-title a').first().attr('href');if(!href)return;const u=new URL(href,origin);if(![origin,'https://www.marleighpark.co.uk'].includes(u.origin))throw new Error('Plot hosted on unsupported external microsite');if(seen.has(u.href))return;seen.add(u.href);const name=a.find('.views-field-title a').first().text().trim();const type=a.find('.views-field-field-plot-type').text().trim();const bedrooms=Number(a.find('.views-field-field-plot-num-bedrooms').text().trim());if(!name)throw new Error('Missing advertised plot metadata');plots.push({externalId:'plot:'+u.pathname,name:name.replace(/,\s*(?:Number|Plot)\s+.*$/i,'').trim(),url:u.href,plotNumber:name.match(/(?:Number|Plot)\s*([\w-]+)/i)?.[1],bedrooms:Number.isInteger(bedrooms)&&bedrooms>0?bedrooms:null,price:Number(a.find('.views-field-field-plot-price .property-price-available').text().replace(/[^\d.]/g,''))||null,propertyType:type,isDetached:/detached/i.test(type),available:true,status:'advertised'});});const advertisedTotal=Number($('main').text().match(/Showing\s+\d+\s+of\s+(\d+)\s+homes/i)?.[1]);if(advertisedTotal&&plots.length!==advertisedTotal)throw new Error('Incomplete plot pagination');const content=($('main').text().split('Nearby developments')[0]||$('body').text()).replace(/\s+/g,' ');if(!plots.length&&!/coming soon|launching soon|sold out|all homes(?:.*sold|.*reserved)|fully reserved/i.test(content))throw new Error('No supported current plot list');return {development:{name,url},homes:plots,plots,plotError:null};}
export function galleryImages(html:string):GalleryImageCandidate[]{const $=load(html);return $('img.image-style-media-gallery').map((i,e)=>{const base=$('link[rel=canonical]').attr('href')??origin;const u=new URL($(e).attr('src')!,base);if(![origin,'https://www.marleighpark.co.uk'].includes(u.origin)||!u.pathname.startsWith('/sites/default/files/'))throw new Error('Unexpected gallery origin');return {url:u.href,position:i,altText:$(e).attr('alt')};}).get();}
// Follow the public table pager, including the linked Marleigh Park microsite.
export async function enrichPage(html:string,fetchText:(url:string)=>Promise<string>){
 const $=load(html);const canonical=$('link[rel="canonical"]').attr('href');if(!canonical)return html;
 const source=new URL(canonical);if(source.origin!==origin)return html;
 let listingUrl=source.href;
 if(source.pathname==='/marleighpark'){
  listingUrl='https://www.marleighpark.co.uk/find-your-new-home';
  const robots=await fetchText('https://www.marleighpark.co.uk/robots.txt');
  if(!/User-agent:/i.test(robots)||/Disallow:\s*\/\s*(?:\n|$)/.test(robots))throw new Error('Microsite robots unavailable or disallowed');
 }
 const visited=new Set<string>([new URL('?page=0',listingUrl).href]);const queue=[listingUrl];const rows:string[]=[];
 while(queue.length){const url=queue.shift()!;if(visited.has(url))continue;if(visited.size>=30)throw new Error('Plot pagination exceeds bounds');visited.add(url);
  const page=load(url===source.href?html:await fetchText(url));
  page('tr.available-home-row').each((_,e)=>{const row=page(e);row.find('a[href]').each((_,a)=>{const href=page(a).attr('href');if(href)page(a).attr('href',new URL(href,url).href);});rows.push(page.html(e));});
  page('a[href]').each((_,e)=>{const href=page(e).attr('href')!;if(!/^\?page=\d+$/.test(href))return;const next=new URL(href,listingUrl);if(!visited.has(next.href))queue.push(next.href);});
 }
 if(rows.length){$('tr.available-home-row').remove();$('body').append('<table id="hill-complete-inventory">'+rows.join('')+'</table>');}
 if(source.pathname==='/marleighpark'&&!rows.length)throw new Error('Microsite inventory missing');
 return $.html();
}
