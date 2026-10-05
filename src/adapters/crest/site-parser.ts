import {load} from 'cheerio';
import type {PropertyCandidate,GalleryImageCandidate} from '../../models/domain.js';
const origin='https://www.crestnicholson.com';
export function developmentUrls(xml:string){const $=load(xml,{xmlMode:true});return [...new Set($('url > loc').map((_,e)=>$(e).text().trim()).get().filter(u=>new URL(u).origin===origin&&/^\/developments\/[^/]+\/[^/]+\/?$/.test(new URL(u).pathname)))];}
export function discoverHomes(html:string,url:string){const $=load(html);const name=$('h1.development__header-title').first().text().trim()||$('h1').last().text().trim();if(!name)throw new Error('Missing development heading');if(!$('#crawler-coverage').length)throw new Error('Rendered plot-list coverage was not captured');const plots:PropertyCandidate[]=[];$('a.standard_home_card').each((_,e)=>{const a=$(e),u=new URL(a.attr('href')!,origin);if(u.origin!==origin)throw new Error('Unexpected plot origin');const description=a.find('.property_price_info p').text(),name=a.find('.title h2').text().trim();plots.push({externalId:'plot:'+u.pathname,name,url:u.href,plotNumber:a.find('.title h3').text().replace(/HOME\s*/i,'').trim(),bedrooms:Number(description.match(/(\d+)\s*bedroom/i)?.[1])||null,price:Number(a.find('.property_price_info h4').text().replace(/[^\d.]/g,''))||null,propertyType:description,isDetached:/detached/i.test(description),available:true,status:'advertised'});});const homes=[...plots];if($('.development-hero img').length)homes.unshift({externalId:'development-gallery',name:'Development gallery',url,bedrooms:null,price:null,propertyType:null,isDetached:null,available:true,status:'development gallery'});return {development:{name,url},homes,plots,plotError:null};}
export function galleryImages(html:string,url?:string):GalleryImageCandidate[]{
 const $=load(html);
 const developmentPage=$('.homes_grid_section').length>0;
 // Redirected, retired plot pages must not acquire the development's images.
 if(developmentPage&&url&&/\/homes\//.test(new URL(url).pathname))return [];
 const selector=developmentPage?'.development-hero img, .development__gallery .gallery-grid img':'.plots_gallery .image_slide img';
 const seen=new Set<string>();
 return $(selector).toArray().flatMap(e=>{const src=$(e).attr('src')||$(e).attr('data-lazy');if(!src)return [];const u=new URL(src,origin);if(u.origin!==origin||!u.pathname.startsWith('/uploads/'))throw new Error('Unexpected gallery origin');if(seen.has(u.href))return [];seen.add(u.href);return [{url:u.href,position:seen.size-1,altText:$(e).attr('alt')}];});
}

/** Fetch every page of the public home-card feed with both filters set to all. */
export async function enrichPage(html:string,fetchText:(url:string,body?:string)=>Promise<string>){
 const $=load(html);
 if(!$('.homes_grid_section').length||$('#crawler-coverage').length)return html;
 const id=html.match(/const developmentId\s*=\s*parseInt\((\d+),/)?.[1];
 if(!id)throw new Error('Missing public development identifier');
 const cards:string[]=[];const seen=new Set<string>();let complete=false;
 for(let offset=0;offset<10000;offset+=24){
  const body=new URLSearchParams({developmentId:id,beds:'all',price:'all',offset:String(offset)}).toString();
  const data=JSON.parse(await fetchText(origin+'/ajax/developments/get-available-homes-cards',body));
  if(typeof data.html!=='string')throw new Error('Missing public home-card HTML');
  const page=load(data.html),links=page('a.standard_home_card').toArray().map(e=>page(e).attr('href')).filter((href):href is string=>Boolean(href));
  if(links.some(link=>seen.has(link)))throw new Error('Repeated public home-card page');
  links.forEach(link=>seen.add(link));cards.push(data.html);
  // Some feeds report count=0 despite returning cards; inspect the page itself.
  if(links.length<24){complete=true;break;}
 }
 if(!complete)throw new Error('Public home-card coverage limit reached');
 $('.homes_grid').first().html(cards.join(''));
 $('body').append('<div id="crawler-coverage"></div>');
 return $.html();
}
