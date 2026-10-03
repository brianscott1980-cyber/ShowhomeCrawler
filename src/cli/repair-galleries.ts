import { parseArgs } from 'node:util';
import { readFile, writeFile, open, unlink } from 'node:fs/promises';
import { builderSite } from '../adapters/sites.js';
import { RequestClient } from '../crawler/request-client.js';
import { imageIdentity, sameVisual, sha256 } from '../galleries/image-hasher.js';
import { writeReport, type RunReport } from '../reports/report.js';

async function main() {
 const {values} = parseArgs({options:{builder:{type:'string'}}});
 if(!values.builder)throw new Error('Builder required');
 const site=builderSite(values.builder),folder=`results/${site.slug}-home-offices`;
 const lock=await open(`${folder}/.lock`,'wx');
 try {
  const report:RunReport=JSON.parse(await readFile(`${folder}/results.json`,'utf8'));
  const failures=new Set(report.errors.filter(e=>e.stage==='gallery').map(e=>e.url));
  const failedImages=new Set(report.errors.filter(e=>e.stage==='image').map(e=>e.url));
  const identities=[];
  for(const image of report.images) identities.push({image,identity:await imageIdentity(await readFile(`${folder}/${image.path}`))});
  const sources=new Map(report.images.map(i=>[i.sourceUrl,i.id]));
  const recovered=new Set<string>();
  const client=new RequestClient({delay:500,retries:2,timeout:30000,maxRequests:5000});
  for(const property of report.properties) {
   const html=await readFile(`results/.cache/pages/${sha256(property.url)}.html`,'utf8').catch(()=>null);
   if(!html)continue;
   let candidates;try{candidates=site.galleryImages(html);}catch{continue;}
   if(!failures.has(property.url)&&!candidates.some(i=>failedImages.has(i.url)))continue;
   let complete=!!candidates.length;
   for(const candidate of candidates) {
    let id=sources.get(candidate.url);
    if(!id)try{
     const cache=`results/.cache/${sha256(candidate.url)}.bin`;
     const bytes=await readFile(cache).catch(()=>client.bytes(candidate.url));
     const identity=await imageIdentity(bytes);
     const known=identities.find(i=>sameVisual(i.identity,identity));
     if(known)id=known.image.id;
     else {
      const path=`images/${identity.sha256}.${identity.format==='jpeg'?'jpg':identity.format}`;
      await writeFile(`${folder}/${path}`,bytes);
      const image={id:identity.sha256,path,sourceUrl:candidate.url};
      report.images.push(image);identities.push({image,identity});id=image.id;
     }
     await writeFile(cache,bytes);sources.set(candidate.url,id);
    }catch{complete=false;continue;}
    if(!property.imageIds.includes(id))property.imageIds.push(id);
    recovered.add(candidate.url);
   }
   if(complete)recovered.add(property.url);
  }
  report.errors=report.errors.filter(e=>!(['gallery','image'].includes(e.stage)&&recovered.has(e.url)));
  report.metrics.pendingImages=report.images.filter(i=>report.analysisVersion==='all-property-images-v1'?!i.categorisation:!i.verdict).length;
  report.status=report.errors.length||report.metrics.pendingImages?'completed_with_gaps':'completed';
  report.completedAt=new Date().toISOString();await writeReport(folder,report);
  console.log(JSON.stringify({builder:site.name,images:report.images.length,remainingErrors:report.errors.length,pendingImages:report.metrics.pendingImages}));
 }finally{await lock.close();await unlink(`${folder}/.lock`);}
}
main().catch(()=>{console.error('Gallery repair failed; inspect the saved report.');process.exitCode=1;});
