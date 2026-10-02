import {readFile,writeFile,readdir} from 'node:fs/promises';
import {builderSite} from '../adapters/sites.js';
import {sha256} from '../galleries/image-hasher.js';
import {propertyStyle} from '../web/site-filters.js';
import type {RunReport} from '../reports/report.js';
async function main(){
 const folders=await readdir('collections');const countries=new Map<string,string>();const codes=new Set<string>();
 for(const folder of folders){const locations=JSON.parse(await readFile(`collections/${folder}/locations.json`,'utf8').catch(()=> '[]'));for(const l of locations)if(l.postcode)codes.add(l.postcode);}
 const postcodes=[...codes];for(let i=0;i<postcodes.length;i+=100){try{const response=await fetch('https://api.postcodes.io/postcodes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({postcodes:postcodes.slice(i,i+100)}),signal:AbortSignal.timeout(20000)});if(!response.ok)continue;const data=await response.json();for(const result of data.result??[])if(result.result?.country)countries.set(result.query.toUpperCase().replace(/\s/g,''),result.result.country);}catch{}}
 for(const folder of folders){const report=JSON.parse(await readFile(`collections/${folder}/results.json`,'utf8')) as RunReport;const locations=JSON.parse(await readFile(`collections/${folder}/locations.json`,'utf8').catch(()=> '[]'));const details=[];
  for(const url of [...new Set(report.properties.filter(p=>p.imageIds.length).map(p=>p.developmentUrl))]){
   let properties;let scope='Published homes';
   try{const site=builderSite(report.builder?.slug);const html=await readFile(`results/.cache/pages/${sha256(url)}.html`,'utf8');const data=site.discoverHomes(html,url);properties=[...data.plots,...data.homes].filter(p=>p.available).map(p=>({identity:p.url+':'+(p.plotNumber??''),price:p.price,bedrooms:p.bedrooms,style:propertyStyle(p.propertyType,p.isDetached)}));if(!properties.length)throw new Error();scope='Advertised homes';}catch{properties=report.properties.filter(p=>p.developmentUrl===url).flatMap(p=>p.plots.length?p.plots.filter(plot=>plot.available).map(plot=>({identity:p.url+':'+(plot.number??''),price:plot.price??p.price,bedrooms:p.bedrooms,style:null})): [{identity:p.url,price:p.price,bedrooms:p.bedrooms,style:null}]);}
   const location=locations.find((l:{url:string})=>l.url===url);const country=location?.postcode?countries.get(location.postcode.toUpperCase().replace(/\s/g,''))??null:null;
   details.push({url,country,scope,properties:[...new Map(properties.map(p=>[p.identity,p])).values()].map(({identity,...p})=>p)});
  }
  await writeFile(`collections/${folder}/site-details.json`,JSON.stringify(details,null,2)+'\n');console.log(JSON.stringify({developer:report.builder?.name,sites:details.length,countryKnown:details.filter(d=>d.country).length,stylesKnown:details.filter(d=>d.properties.some(p=>p.style)).length}));
 }
}
main().catch(()=>{console.error('Site details generation failed');process.exitCode=1;});
