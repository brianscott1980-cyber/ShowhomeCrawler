import {readdir,readFile,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
import {sha256} from '../galleries/image-hasher.js';
import {RequestClient} from '../crawler/request-client.js';
import type {RunReport} from '../reports/report.js';
const client=new RequestClient({delay:500,retries:2,timeout:15000,maxRequests:200});
const postcodePattern=/\b(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i;
function extract(html:string,url:string){
 const $=load(html);const nodes:any[]=[];
 function walk(value:any){if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(walk);return;}nodes.push(value);Object.values(value).forEach(walk);}
 $('script[type="application/ld+json"]').each((_,e)=>{try{walk(JSON.parse($(e).text()));}catch{}});
 const place=nodes.find(n=>n.geo&&n.address&&!JSON.stringify(n['@type']??'').includes('Organization'));
 const lat=Number(place?.geo?.latitude),lon=Number(place?.geo?.longitude);
 if(Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=49&&lat<=61&&lon>=-9&&lon<=3)return {latitude:lat,longitude:lon,postcode:place.address.postalCode as string|undefined};
 for(const iframe of $('iframe[src]').toArray()){try{const map=new URL($(iframe).attr('src')!);if(!['www.google.com','maps.google.com'].includes(map.hostname))continue;const parts=(map.searchParams.get('center')??map.searchParams.get('q'))?.split(',').map(Number);if(parts?.length===2&&parts[0]!>=49&&parts[0]!<=61&&parts[1]!>=-9&&parts[1]!<=3)return {latitude:parts[0]!,longitude:parts[1]!};}catch{}}
 const address=nodes.find(n=>n.address?.postalCode&&/LocalBusiness|RealEstateAgent|Residence|Housing|HomeAndConstructionBusiness/.test(JSON.stringify(n['@type']??''))&&!JSON.stringify(n['@type']).includes('Organization'));
 if(address)return {postcode:String(address.address.postalCode)};
 for(const e of $('script[type="application/json"]').toArray()){try{const d=JSON.parse($(e).text()).hgpSearch?.developments?.find((d:any)=>new URL(d.url,url).pathname===new URL(url).pathname);if(d?.postcode)return {postcode:String(d.postcode)};}catch{}}
 $('header,footer,nav,script,style').remove();
 return {postcode:($('main').text()||$('body').text()).match(postcodePattern)?.[0]};
}
async function main(){
 for(const folder of await readdir('collections')){
  const report=JSON.parse(await readFile(`collections/${folder}/results.json`,'utf8')) as RunReport;
  const previous=await readFile(`collections/${folder}/locations.json`,'utf8').then(s=>JSON.parse(s) as {url:string;name:string;latitude?:number;longitude?:number;postcode?:string}[]).catch(()=>[]);
  const homes=report.properties.filter(p=>p.imageIds.length);const entries=[];
  for(const url of [...new Set(homes.map(p=>p.developmentUrl))]){
   const known=previous.find(p=>p.url===url);if(known&&Number.isFinite(known.latitude)&&Number.isFinite(known.longitude)){entries.push(known);continue;}
   let html=await readFile(`results/.cache/pages/${sha256(url)}.html`,'utf8').catch(()=> '');let found=extract(html,url);
   if(!found.postcode&&!('latitude' in found)){try{html=await client.text(url);found=extract(html,url);}catch{}}
   if(!('latitude' in found)&&found.postcode){try{const response=await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(found.postcode)}`);const data=await response.json();if(response.ok&&data.result?.latitude&&data.result?.longitude)found={...found,latitude:data.result.latitude,longitude:data.result.longitude};}catch{}}
   entries.push({name:homes.find(p=>p.developmentUrl===url)!.development,url,...found});
  }
  await writeFile(`collections/${folder}/locations.json`,JSON.stringify(entries,null,2)+'\n');
  console.log(JSON.stringify({developer:folder,located:entries.filter(e=>'latitude'in e).length,total:entries.length}));
 }
}
main().catch(()=>{console.error('Collection location extraction failed');process.exitCode=1;});
