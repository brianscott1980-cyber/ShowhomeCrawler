import {load} from 'cheerio';
const postcodePattern=/\b(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i;
export function extractDevelopmentCoordinates(html:string,url:string):{latitude?:number;longitude?:number;postcode?:string}{
 const $=load(html);const nodes:any[]=[];
 function walk(value:any){if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(walk);return;}nodes.push(value);Object.values(value).forEach(walk);}
 $('script[type="application/ld+json"]').each((_,e)=>{try{walk(JSON.parse($(e).text()));}catch{}});
 const place=nodes.find(n=>n.geo&&n.address&&!JSON.stringify(n['@type']??'').includes('Organization'));
 const lat=Number(place?.geo?.latitude),lon=Number(place?.geo?.longitude);
 if(Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=49&&lat<=61&&lon>=-9&&lon<=3)return {latitude:lat,longitude:lon,postcode:place.address.postalCode as string|undefined};
 for(const iframe of $('iframe[src]').toArray()){try{const map=new URL($(iframe).attr('src')!);if(!['www.google.com','maps.google.com'].includes(map.hostname))continue;const parts=(map.searchParams.get('center')??map.searchParams.get('q'))?.split(',').map(Number);if(parts?.length===2&&parts[0]!>=49&&parts[0]!<=61&&parts[1]!>=-9&&parts[1]!<=3)return {latitude:parts[0]!,longitude:parts[1]!};}catch{}}
 for(const element of $('[data-lat][data-lon]').toArray()){
  const latitude=Number($(element).attr('data-lat')),longitude=Number($(element).attr('data-lon'));
  if(latitude>=49&&latitude<=61.2&&longitude>=-9&&longitude<=3)return {latitude,longitude};
 }
 for(const element of $('a[href*="google.com/maps"]').toArray()){
  const href=$(element).attr('href')!;
  const point=href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)??href.match(/\/dir\/\/(-?\d+\.\d+),(-?\d+\.\d+)/);
  const reversed=href.match(/!1d(-?\d+\.\d+)!2d(-?\d+\.\d+)/);
  const latitude=Number(point?.[1]??reversed?.[2]),longitude=Number(point?.[2]??reversed?.[1]);
  if(latitude>=49&&latitude<=61.2&&longitude>=-9&&longitude<=3)return {latitude,longitude};
 }
 const address=nodes.find(n=>n.address?.postalCode&&/LocalBusiness|RealEstateAgent|Residence|Housing|HomeAndConstructionBusiness/.test(JSON.stringify(n['@type']??''))&&!JSON.stringify(n['@type']).includes('Organization'));
 if(address)return {postcode:String(address.address.postalCode)};
 for(const e of $('script[type="application/json"]').toArray()){try{const d=JSON.parse($(e).text()).hgpSearch?.developments?.find((d:any)=>new URL(d.url,url).pathname===new URL(url).pathname);if(d?.postcode)return {postcode:String(d.postcode)};}catch{}}
 $('header,footer,nav,script,style').remove();
 return {postcode:($('main').text()||$('body').text()).match(postcodePattern)?.[0]};
}
