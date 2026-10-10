import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import type {RunReport} from '../reports/report';
/** Separate classifier snapshots prevent either worker overwriting the other's files. */
export async function classificationSnapshot(slug:string,crawlFolder:string):Promise<RunReport|undefined>{
 const load=async(file:string):Promise<RunReport|undefined>=>readFile(file,'utf8').then(JSON.parse).catch(()=>undefined);
 const canonical=await load(resolve('collections',slug+'-home-offices','results.json'));
 const local=await load(resolve('.showhome/processing/classification-work',slug,'results.json'));
 const published=local??canonical;
 if(local&&canonical){const known=new Map(canonical.images.filter(image=>image.categorisation).map(image=>[image.id,image]));for(const image of local.images)if(!image.categorisation&&known.has(image.id))Object.assign(image,known.get(image.id));}
 const gemini=await load(resolve('.showhome/processing/gemini-work',slug,'results.json'));
 if(published&&gemini){const known=new Map(gemini.images.filter(i=>i.categorisation).map(i=>[i.id,i]));for(const image of published.images)if(!image.categorisation&&known.has(image.id))Object.assign(image,known.get(image.id));}
 const crawl=await load(resolve(crawlFolder,'checkpoint.json'))??await load(resolve(crawlFolder,'results.json'));
 if(!crawl)return published??gemini;
 if(!published)return crawl;
 const known=new Map(published.images.map(image=>[image.id,image]));
 const images=crawl.images.map(image=>image.categorisation?image:known.get(image.id)?.categorisation?{...image,...known.get(image.id)}:image);
 const ids=new Set(images.map(image=>image.id));
 images.push(...published.images.filter(image=>!ids.has(image.id)));
 const homes=new Map(published.properties.map(home=>[home.url,home]));
 for(const home of crawl.properties){const old=homes.get(home.url);homes.set(home.url,{...home,imageIds:[...new Set([...(old?.imageIds??[]),...home.imageIds])]});}
 const developments=new Map(published.developments.map(development=>[development.url,development]));
 for(const development of crawl.developments)developments.set(development.url,development);
 return {...crawl,status:'completed_with_gaps',images,properties:[...homes.values()],developments:[...developments.values()]};
}
