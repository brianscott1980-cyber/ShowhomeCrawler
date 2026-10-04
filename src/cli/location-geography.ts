import {readdir,readFile,writeFile,rename} from 'node:fs/promises';
import type {LocationRow} from '../web/location-geography';
async function main(){
 const folders=(await readdir('collections')).filter(folder=>folder.endsWith('-home-offices'));
 const rows=(await Promise.all(folders.map(async folder=>{const locations=await readFile(`collections/${folder}/locations.json`,'utf8').then(s=>JSON.parse(s) as LocationRow[]).catch(()=>[]);return locations.map(row=>({slug:folder.replace(/-home-offices$/,''),row}));}))).flat();
 const codes=[...new Set(rows.map(({row})=>row.postcode).filter((v):v is string=>Boolean(v)))];
 const postcodeData=new Map<string,Record<string,string|null>>();
 const normal=(code:string)=>code.toUpperCase().replace(/\s/g,'');
 const geography=(data:any)=>({country:data.country??null,region:data.region??null,district:data.admin_district??null});
 for(let i=0;i<codes.length;i+=100){
  const response=await fetch('https://api.postcodes.io/postcodes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({postcodes:codes.slice(i,i+100)}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`Postcode lookup failed (${response.status})`);
  const data=await response.json();for(const item of data.result??[])if(item.result)postcodeData.set(normal(item.query),geography(item.result));
 }
 const index:Record<string,unknown>={};
 const missing=rows.filter(({row})=>!row.postcode||!postcodeData.has(normal(row.postcode)));
 for(let i=0;i<missing.length;i+=10){
  await Promise.all(missing.slice(i,i+10).map(async ({slug,row})=>{
   if(!Number.isFinite(row.latitude)||!Number.isFinite(row.longitude))return;
   const response=await fetch(`https://api.postcodes.io/postcodes?lat=${row.latitude}&lon=${row.longitude}&limit=1&radius=2000`,{signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw new Error(`Reverse lookup failed (${response.status})`);
   const data=await response.json();if(data.result?.[0])index[`${slug}:${row.url}`]={postcode:row.postcode,latitude:row.latitude,longitude:row.longitude,geography:geography(data.result[0])};
  }));
 }
 for(const {slug,row} of rows){const data=row.postcode?postcodeData.get(normal(row.postcode)):undefined;if(data)index[`${slug}:${row.url}`]={postcode:row.postcode,latitude:row.latitude,longitude:row.longitude,geography:data};}
 await writeFile('collections/location-geography.json.tmp',JSON.stringify(index,null,2)+'\n');await rename('collections/location-geography.json.tmp','collections/location-geography.json');
 console.log(`Geography saved for ${Object.keys(index).length} of ${rows.length} locations.`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
