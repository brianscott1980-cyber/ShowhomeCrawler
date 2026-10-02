import { readFile, writeFile, open, unlink } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { load } from 'cheerio';
import { RequestClient } from '../crawler/request-client.js';
import { builderSite } from '../adapters/sites.js';
import { sha256 } from '../galleries/image-hasher.js';
import { writeReport, type RunReport } from '../reports/report.js';
async function main() {
 const { values } = parseArgs({ options: { folder: { type: 'string', default: 'results/bellway-home-offices' } } });
 const folder=values.folder, lock=await open(folder+'/.lock','wx');
 try {
  const report: RunReport=JSON.parse(await readFile(folder+'/results.json','utf8'));
  const { discoverHomes } = builderSite(report.builder?.slug);
  const client=new RequestClient({delay:500,retries:3,timeout:15000,maxRequests:1000});
  for(const development of report.developments.filter(d=>d.status==='failed')) {
   try {
   const cached=`results/.cache/pages/${sha256(development.url)}.html`;
   const html=await readFile(cached,'utf8').catch(()=>client.text(development.url)), result=discoverHomes(html,development.url);
   const qualifying=result.homes.filter(p=>(p.bedrooms??0)>=5);
   if(qualifying.some(p=>!report.properties.some(existing=>existing.url===p.url))) throw new Error('Repair found new qualifying work; rerun crawler.');
   const $=load(html); $('[wire\\:initial-data]').removeAttr('wire:initial-data'); $('script').not('[type="application/ld+json"], [type="application/json"]').remove(); $('input[type="hidden"]').remove();
   await writeFile(`results/.cache/pages/${sha256(development.url)}.html`,$.html());
   development.status='complete'; development.name=result.development.name; development.homes=result.homes.length; development.qualifying=qualifying.length;
   development.warning=result.development.url!==development.url?'Redirected to '+result.development.url:result.plotError??undefined;
   delete development.error; report.errors=report.errors.filter(e=>e.stage!=='development'||e.url!==development.url);
   console.log(JSON.stringify({repaired:development.url,canonical:result.development.url,qualifying:qualifying.length}));
   } catch { console.log(JSON.stringify({unrepaired:development.url})); }
  }
  report.status=report.errors.length||report.images.some(i=>!i.verdict)?'completed_with_gaps':'completed';
  await writeReport(folder,report);
 }finally{await lock.close();await unlink(folder+'/.lock');}
}
main().catch(()=>{console.error('Coverage repair failed; details and credentials withheld.');process.exitCode=1;});
