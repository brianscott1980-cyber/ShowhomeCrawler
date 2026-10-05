import {readFile,writeFile,rename} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {load} from 'cheerio';
import {developers,readCollection} from '../web/collections';
import {readLocationRows} from '../web/location-geography';
import {extractDevelopmentCoordinates} from '../web/development-location-source';
import {RequestClient,mapLimit} from '../crawler/request-client';
import {sha256} from '../galleries/image-hasher';
import {milesBetween} from '../web/site-filters';
type Town={id:string;town:string;country:string;latitude:number;longitude:number};
const target='collections/development-places.json';
const client=new RequestClient({delay:500,retries:1,timeout:15000,maxRequests:6000});
async function main(){
 const {values}=parseArgs({options:{builder:{type:'string'}}});
 const towns=JSON.parse(await readFile('results/.cache/uk-towns.json','utf8')) as Town[];
 const index:Record<string,any>=await readFile(target,'utf8').then(JSON.parse).catch(()=>({}));
 const entries=(await Promise.all(developers.filter(builder=>!values.builder||builder.slug===values.builder).map(async builder=>{
  const [report,locations]=await Promise.all([readCollection(builder.slug),readLocationRows(builder.slug)]);
  return (report?.developments??[]).map(development=>({builder,development,known:locations.find(location=>location.url===development.url)}));
 }))).flat();
 let done=0;let writes=Promise.resolve();
 const save=()=>{writes=writes.then(async()=>{await writeFile(target+'.tmp',JSON.stringify(index,null,2)+'\n');await rename(target+'.tmp',target);});return writes;};
 await mapLimit(entries,3,async({builder,development,known})=>{
  const key=`${builder.slug}:${development.url}`;
  if(index[key]?.town&&index[key]?.country){done++;return;}
  let html=await readFile(`results/.cache/pages/${sha256(development.url)}.html`,'utf8').catch(()=> '');
  let source=extractDevelopmentCoordinates(html,development.url);
  let latitude=known?.latitude??('latitude'in source?source.latitude:undefined),longitude=known?.longitude??('longitude'in source?source.longitude:undefined),postcode=known?.postcode??source.postcode;
  let country=known?.country??known?.geography?.country;
  if(!['England','Scotland','Wales','Northern Ireland'].includes(country??''))country=undefined;
  if((!Number.isFinite(latitude)||!Number.isFinite(longitude))&&!postcode){
   try{html=await client.text(development.url);source=extractDevelopmentCoordinates(html,development.url);latitude='latitude'in source?source.latitude:latitude;longitude='longitude'in source?source.longitude:longitude;postcode=source.postcode;}catch{}
  }
  if((!Number.isFinite(latitude)||!Number.isFinite(longitude))&&postcode){
   try{const response=await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`,{signal:AbortSignal.timeout(15000)});const data=await response.json();if(data.result||data.terminated){const location=data.result??data.terminated;latitude=location.latitude;longitude=location.longitude;country=location.country??country;}}catch{}
  }
  let town:string|null=null,method='',placeId:string|undefined,distance:number|undefined;
  if(Number.isFinite(latitude)&&Number.isFinite(longitude)){
   const candidates=country?towns.filter(place=>place.country===country):towns;
   const nearest=candidates.map(place=>({place,distance:milesBetween({latitude:latitude!,longitude:longitude!},place)})).sort((a,b)=>a.distance-b.distance)[0];
   if(nearest&&nearest.distance<30){town=nearest.place.town;country=country??nearest.place.country;placeId=nearest.place.id;distance=nearest.distance;method='nearest_named_settlement';}
  }
  // Prefer a development-specific structured postal locality when supplied by its builder.
  const $=load(html);let advertisedTown:string|undefined;
  function walk(value:any){if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(walk);return;}if(value.address?.addressLocality&&!/Organization/.test(String(value['@type']))&&(/Place|Residence|Housing|RealEstate|LocalBusiness|Product|HomeAndConstruction/.test(String(value['@type']))||value.geo))advertisedTown=String(value.address.addressLocality).trim();Object.values(value).forEach(walk);}
  $('script[type="application/ld+json"]').each((_,element)=>{try{walk(JSON.parse($(element).text()));}catch{}});
  if(advertisedTown&&Number.isFinite(latitude)&&Number.isFinite(longitude)){const candidate=towns.find(place=>place.town.toLowerCase()===advertisedTown!.toLowerCase()&&milesBetween({latitude:latitude!,longitude:longitude!},place)<3);if(candidate){town=advertisedTown;country=country??candidate.country;method='builder_postal_locality';}}
  index[key]={name:development.name??development.url.split('/').filter(Boolean).at(-1),url:development.url,town,country:country??null,postcode,latitude,longitude,locationSource:method==='builder_postal_locality'?development.url:placeId?`https://www.geonames.org/${placeId}`:null,locationMethod:method||'unresolved',nearestTownMiles:distance,status:town&&country?'complete':'needs_location_review',checkedAt:new Date().toISOString()};
  done++;if(done%25===0){await save();console.log(JSON.stringify({checked:done,total:entries.length,resolved:entries.filter(entry=>index[`${entry.builder.slug}:${entry.development.url}`]?.status==='complete').length}));}
 });
 await save();console.log(JSON.stringify({checked:entries.length,resolved:entries.filter(entry=>index[`${entry.builder.slug}:${entry.development.url}`]?.town&&index[`${entry.builder.slug}:${entry.development.url}`]?.country).length,missing:entries.filter(entry=>!index[`${entry.builder.slug}:${entry.development.url}`]?.town||!index[`${entry.builder.slug}:${entry.development.url}`]?.country).map(entry=>({builder:entry.builder.slug,url:entry.development.url}))}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
