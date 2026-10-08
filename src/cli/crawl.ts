import {insideResults} from '../crawler/output-folder.js';
import {readCollection} from '../catalogue/files.js';
import {progressReporter} from '../reports/pipeline-progress.js';
import {storedFile} from '../web/content-storage.js';
import sharp from 'sharp';
import { mkdir, readFile, writeFile, rename, open, link } from 'node:fs/promises';
import { resolve,basename } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { load } from 'cheerio';
import { readEnv } from '../config/env.js';
import { RequestClient, mapLimit } from '../crawler/request-client.js';
import { discoverSitemapDevelopments } from '../crawler/sitemaps.js';
import { builderSite } from '../adapters/sites.js';
import { sha256, imageIdentity, sameVisual } from '../galleries/image-hasher.js';
import { ImageSourceCache, imageSourceKey } from '../galleries/image-source-cache.js';
import { analysisVersion, question, classify, verdictSchema } from '../vision/gemini-classifier.js';
import { writeReport, type RunReport, type ReportImage } from '../reports/report.js';
import { createDatabase } from '../database/postgres.js';
import { PostgresCatalogRepository } from '../database/repositories/postgres-catalog-repository.js';
async function exists(path: string) { try { await readFile(path); return true; } catch { return false; } }
async function atomic(path: string, value: unknown) { const temporary = path + '.' + randomUUID() + '.tmp'; await writeFile(temporary, JSON.stringify(value)); await rename(temporary, path); }
async function main() {
 const env = readEnv();
 const { values } = parseArgs({ options: { 'preserve-existing':{type:'boolean'},'content-root':{type:'string'},resume: {type:'boolean'}, 'refresh-pages': { type: 'boolean' }, 'live-missing': { type: 'boolean' }, 'all-images': { type: 'boolean', default: true }, 'browser-snapshots': { type: 'boolean' }, builder: { type: 'string', default: 'bellway' }, 'min-bedrooms': { type: 'string', default: '1' }, 'max-developments': { type: 'string', default: String(env.MAX_DEVELOPMENTS) }, 'max-properties': { type: 'string', default: String(env.MAX_PROPERTIES) }, 'max-images': { type: 'string', default: '500' }, output: { type: 'string' }, 'discover-only': { type: 'boolean', default: true }, development: { type: 'string', multiple: true }, persist: { type: 'boolean' } } });
 const site = builderSite(values.builder); const { developmentUrls, discoverHomes, galleryImages } = site;
 const number = (v: string, max: number) => { const n = Number(v); if (!Number.isInteger(n) || n <= 0 || n > max) throw new Error('Invalid crawl limit.'); return n; };
 const maxDevs = number(values['max-developments'], 1000), maxProperties = number(values['max-properties'], 10000), maxImages = number(values['max-images'], 100000);
 if (values['all-images'] && !values['discover-only']) throw new Error('All-images crawling requires --discover-only; categorise with results:classify --all-images.');
 if(values.resume && (!values['all-images'] || !values['discover-only']))throw new Error('Resume requires all-images discovery.');
 const model = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
 if (!values['discover-only'] && !env.GEMINI_API_KEY) throw new Error('Set GEMINI_API_KEY locally or use --discover-only.');
 const folder = resolve(values.output ?? `results/${site.slug}-home-offices`);
 if (!insideResults(resolve('results'),folder)) throw new Error('Output must be within results/.');
 await mkdir(folder + '/images', { recursive: true }); await mkdir('results/.cache/pages', { recursive: true }); await mkdir('results/.cache/analysis', { recursive: true });
 const previous:RunReport|undefined=values.resume?JSON.parse(await readFile(folder+'/checkpoint.json','utf8')):values['preserve-existing']?await readCollection(site.slug)??undefined:undefined;
 if(values.resume&&previous && (previous.builder?.slug!==site.slug || previous.analysisVersion!=='all-property-images-v1'))throw new Error('Resume checkpoint does not match this builder and mode.');
 const lock = await open(folder + '/.lock', 'wx').catch(() => { throw new Error('This output folder is already locked by another crawl.'); });
 const client = new RequestClient({ delay: Math.max(500, env.REQUEST_DELAY_MS), retries: env.MAX_RETRIES, timeout: env.REQUEST_TIMEOUT_MS, maxRequests: 40000 });
 const page = async (url: string) => {
  const path = `results/.cache/pages/${sha256(url)}.html`;
  if (values['browser-snapshots'] && !values['live-missing']) {
   for (let attempt = 0; attempt < 60 && !await exists(path); attempt++) await sleep(1000);
   if (!await exists(path)) throw new Error('Browser snapshot unavailable.');
  }
  if (!values['refresh-pages']) {try{return (await storedFile(path)).toString('utf8')}catch{}}
  let html = await client.text(url);
  if ('enrichPage' in site && site.enrichPage) html = await site.enrichPage(html, async (apiUrl,body?:string) => client.text(apiUrl,body));
  // Remove transient Livewire/session data from local cached pages.
  const $ = load(html); $('[wire\\:initial-data]').removeAttr('wire:initial-data'); $('script').not('[type="application/ld+json"], [type="application/json"]').remove(); $('input[type="hidden"]').remove();
  const sanitized = $.html(); await writeFile(path, sanitized); return sanitized;
 };
 const sql = values.persist ? createDatabase() : null;
 const repo = sql ? new PostgresCatalogRepository(sql, site) : null;
 const report: RunReport = { builder: { name:site.name, slug:site.slug, websiteUrl:site.websiteUrl }, status: 'running', startedAt: new Date().toISOString(), model, question: values['all-images'] ? 'All property gallery images' : question, analysisVersion: values['all-images'] ? 'all-property-images-v1' : analysisVersion, developments: [], properties: [], images: [], errors: [], metrics: {} };
 if(previous){report.startedAt=previous.startedAt;report.images=previous.images;report.errors=previous.errors.filter(e=>e.stage==='image');report.properties=previous.properties.filter(p=>p.imageIds.length>0&&!previous.errors.some(e=>e.url===p.url));}
 const progress=progressReporter('crawl');
 report.crawlProgress={status:'running',updatedAt:new Date().toISOString(),currentDevelopments:[],galleries:values.resume?(previous?.crawlProgress?.galleries??Object.fromEntries((previous?.properties??[]).filter(p=>p.imageIds.length>0).map(p=>[p.url,'completed' as const]))):{}};
 const activeGalleries=new Map<string,string>();
 async function updateGallery(url:string,status:'completed'|'failed'){report.crawlProgress!.galleries![url]=status;activeGalleries.delete(url);report.crawlProgress!.currentDevelopments=[...new Set(activeGalleries.values())];await progress.update(site.slug,report,true);}
 let stopped = false; process.once('SIGINT', () => { stopped = true; }); process.once('SIGTERM', () => { stopped = true; });
 try {
  const sourceText = (url: string) => values['browser-snapshots'] ? readFile(`results/.cache/pages/${sha256(url)}.html`, 'utf8') : client.text(url);
  const robots = await sourceText(site.websiteUrl + '/robots.txt').catch(() => '');
  if (!/User-agent:/i.test(robots)) {
   report.errors.push({url:site.websiteUrl+'/robots.txt',stage:'robots',message:'Robots rules unavailable; only public development and property pages collected.'});
  }
  if (/Disallow:\s*\/\s*(?:\n|$)/.test(robots)) throw new Error('robots.txt disallows crawling.');
  const all = await discoverSitemapDevelopments(site.sitemap, developmentUrls, sourceText);
  if (!all.length) throw new Error('No development URLs found.');
  let urls = all.slice(0, maxDevs);
  if (values.development) { if (values.development.some(url=>!all.includes(url))) throw new Error('Development is not in the builder sitemap.'); urls = [...new Set(values.development)]; }
  report.metrics.sitemapDevelopments = all.length;report.metrics.selectedDevelopments=urls.length;
  console.log(JSON.stringify({ stage: 'discovery', sitemapDevelopments: all.length, selected: urls.length }));
  await progress.update(site.slug,report,true);
  const discovered = await mapLimit(urls, Math.min(3, env.MAX_CONCURRENCY), async url => {
   if (stopped) return null;
   try {
    const result = discoverHomes(await page(url), url);
    if (repo && result.plots.length) await repo.saveDevelopment(result.development, result.plots);
    const qualifying = result.homes;
    report.developments.push({ url, name: result.development.name, status: result.plotError ? 'complete_with_warning' : 'complete', homes: result.homes.length, qualifying: qualifying.length, warning: result.plotError ?? (result.development.url !== url ? 'Redirected to ' + result.development.url : undefined) });
    console.log(JSON.stringify({ stage: 'development', developer: site.name, completed: report.developments.length, total: urls.length, name: result.development.name, homes: result.homes.length, qualifying: qualifying.length }));
    await atomic(folder + '/checkpoint.json', report);await progress.update(site.slug,report);
    return { ...result, qualifying };
   } catch (error) {
    const message = error instanceof Error && error.message.startsWith('HTTP ') ? error.message : 'Development extraction or persistence failed';
    report.developments.push({ url, status: 'failed', error: message }); report.errors.push({ url, stage: 'development', message }); console.log(JSON.stringify({stage:'development_failed',developer:site.name,completed:report.developments.length,total:urls.length,url,message})); return null;
   }
  });
  const homes = discovered.flatMap(d => d ? d.qualifying.map(home => ({ home, development: d.development, plots: d.plots.filter(p => p.url === home.url) })) : []);
  report.metrics.qualifyingDiscovered = homes.length;
  report.metrics.propertyLimitOmissions = Math.max(0, homes.length - maxProperties);
  const sourceImages = new Map<string, ReportImage>();
  const sourceTasks = new ImageSourceCache<string>();
  const identities: { identity: Awaited<ReturnType<typeof imageIdentity>>; image: ReportImage }[] = [];
  const galleryCache = new Map<string, string[]>();
  for(const image of report.images){sourceImages.set(image.sourceUrl,image);if(values.resume){const bytes=values['content-root']?await readFile(resolve(values['content-root'],'assets',basename(image.path))):await storedFile(folder+'/'+image.path);const identity=await imageIdentity(bytes);if(identity.sha256!==image.id)throw new Error('Resume image does not match its identifier.');identities.push({identity,image});}}
  const completedProperties=new Set(values.resume?report.properties.map(p=>p.url):[]);
  report.metrics.skippedCompletedGalleries=0;
  let imageAttempts = 0, analysisUnavailable = false;
  // All-images runs share at most three gallery workers, each with one image request at a time.
  await mapLimit(homes.slice(0, maxProperties), values['all-images'] ? Math.min(3, env.MAX_CONCURRENCY) : 1, async ({ home, development, plots }) => {
   if (stopped) return;
   if (completedProperties.has(home.url)){report.metrics.skippedCompletedGalleries=(report.metrics.skippedCompletedGalleries??0)+1;return;}
   activeGalleries.set(home.url,development.name);report.crawlProgress!.galleries![home.url]='running';report.crawlProgress!.currentDevelopments=[...new Set(activeGalleries.values())];await progress.update(site.slug,report);
   let galleryFailed=false;
   const property = { development: development.name, developmentUrl: development.url, name: home.plotNumber ? `${home.name} · Plot ${home.plotNumber}` : home.name, url: home.url, bedrooms: home.bedrooms!, price: home.price, plots: plots.map(p => ({ number: p.plotNumber, price: p.price, available: p.available })), imageIds: [] as string[] };
   const previousProperty=report.properties.findIndex(p=>p.url===home.url);if(previousProperty>=0)report.properties.splice(previousProperty,1,property);else report.properties.push(property);
   try {
    const html = await page(home.url);
    if ('houseTypeName' in site) {
     const name = site.houseTypeName(html);
     if (name) property.name = name;
    }
    const images = galleryImages(html,home.url);
    if (!images.length) galleryFailed=true;
    if (!images.length) report.errors.push({ url: home.url, stage: 'gallery', message: 'No supported image gallery found; not treated as a negative match.' });
    const galleryKey = sha256(JSON.stringify([...new Set(images.map(i => imageSourceKey(i.url)))].sort()));
    const reused = galleryCache.get(galleryKey);
    if (reused) { property.imageIds = reused; report.metrics.reusedGalleries = (report.metrics.reusedGalleries ?? 0) + 1; await updateGallery(home.url,galleryFailed?'failed':'completed');await writeReport(folder,report);return; }
    const imageIds = await mapLimit(images, values['all-images'] ? 1 : Math.min(3, env.MAX_CONCURRENCY), async candidate => {
     if (stopped) return null;
     const id=await sourceTasks.get(candidate.url, async () => {
     const known = sourceImages.get(candidate.url);
     if (known) {report.metrics.reusedImageSources=(report.metrics.reusedImageSources??0)+1;return known.id;}
     if (imageAttempts >= maxImages) { report.metrics.imageLimitOmissions = (report.metrics.imageLimitOmissions ?? 0) + 1; return null; }
     imageAttempts++;
     try {
      const imagePath = `results/.cache/${sha256(candidate.url)}.bin`;
      const rawBytes = await storedFile(imagePath).catch(error=>{
       if(error.storedOnNas)throw error; // Do not download an existing NAS image again while away.
       return client.bytes(candidate.url);
      });
      const bytes = new URL(candidate.url).pathname.toLowerCase().endsWith('.svg') ? await sharp(rawBytes).png().toBuffer() : rawBytes;
      const identity = await imageIdentity(bytes);
      if(!values['content-root']&&!await exists(imagePath))await writeFile(imagePath, bytes);
      const path = `images/${identity.sha256}.${identity.format === 'jpeg' ? 'jpg' : identity.format}`;
      if(values['content-root']){const target=resolve(values['content-root'],'assets',basename(path));await writeFile(target,bytes,{flag:'wx'}).catch(error=>{if(error.code!=='EEXIST')throw error;});}
      else if(!await exists(`${folder}/${path}`))await link(imagePath,`${folder}/${path}`).catch(()=>writeFile(`${folder}/${path}`,bytes));
      // Claim identity synchronously after file I/O so concurrent copies cannot both be registered.
      const existing = identities.find(i => sameVisual(i.identity, identity))??(report.images.find(i=>i.id===identity.sha256)?{image:report.images.find(i=>i.id===identity.sha256)!}:undefined);
      if (existing) { sourceImages.set(candidate.url, existing.image); report.metrics.reusedImages = (report.metrics.reusedImages ?? 0) + 1; return existing.image.id; }
      const image: ReportImage = { id: identity.sha256, path, sourceUrl: candidate.url };
      identities.push({ identity, image }); sourceImages.set(candidate.url, image); report.images.push(image);
      const key = sha256(`${identity.sha256}:${model}:${analysisVersion}`), analysisPath = `results/.cache/analysis/${key}.json`;
      if (!values['discover-only'] && await exists(analysisPath)) image.verdict = verdictSchema.parse(JSON.parse(await readFile(analysisPath, 'utf8')));
      else if (!values['discover-only'] && !analysisUnavailable) {
       try {
        image.verdict = await classify(bytes, env.GEMINI_API_KEY!, model);
        await atomic(analysisPath, image.verdict);
        console.log(JSON.stringify({ stage: 'classified', image: image.id.slice(0, 12), matches: image.verdict.matches }));
       } catch (error) {
        const message = error instanceof Error && /^Gemini HTTP \d+$/.test(error.message) ? error.message : 'Classification failed or output invalid';
        image.error = message;
        if (/Gemini HTTP (400|401|403|404|429)/.test(message)) analysisUnavailable = true;
        report.errors.push({ url: candidate.url, stage: 'classification', message });
       }
      } else image.error = values['discover-only'] ? 'Classification not requested' : 'Classifier unavailable after earlier API error';
      await atomic(folder + '/checkpoint.json', report);
      return image.id;
     } catch { report.errors.push({ url: candidate.url, stage: 'image', message: 'Image download or hashing failed' }); return null; }
     }, () => { report.metrics.reusedImageSources = (report.metrics.reusedImageSources ?? 0) + 1; });
     if(id&&!property.imageIds.includes(id))property.imageIds.push(id);await progress.update(site.slug,report);return id;
    });
    if(imageIds.some(id=>id===null))galleryFailed=true;
    property.imageIds = imageIds.filter((id): id is string => id !== null);
    property.imageIds = [...new Set(property.imageIds)];
    if (imageIds.every(id => id !== null)) galleryCache.set(galleryKey, property.imageIds);
    console.log(JSON.stringify({ stage: 'gallery', developer: site.name, completed: report.properties.length, total: Math.min(homes.length,maxProperties), development: development.name, home: home.name, images: images.length, uniqueImages: report.images.length }));
   } catch { galleryFailed=true;report.errors.push({ url: home.url, stage: 'gallery', message: 'House page or gallery extraction failed' }); }
   await updateGallery(home.url,galleryFailed?'failed':'completed');
   await writeReport(folder, report);
  });
  report.metrics.imagesAttempted = imageAttempts;
  report.metrics.pendingImages = report.images.filter(i => !i.verdict).length;
  report.metrics.matchedImages = report.images.filter(i => i.verdict?.matches).length;
  report.metrics.developmentLimitOmissions = values.development ? 0 : Math.max(0, all.length - urls.length);
  report.status = stopped ? 'cancelled' : report.errors.length || report.metrics.pendingImages || report.metrics.propertyLimitOmissions || report.metrics.imageLimitOmissions || report.metrics.developmentLimitOmissions ? 'completed_with_gaps' : 'completed';
  report.crawlProgress!.status=stopped?'stopped':report.errors.some(e=>['image','gallery','development','source'].includes(e.stage))?'failed':'completed';report.crawlProgress!.currentDevelopments=[];await progress.update(site.slug,report,true);
  report.completedAt = new Date().toISOString(); await writeReport(folder, report); await atomic(folder + '/checkpoint.json', report);
  console.log(JSON.stringify({ stage: 'finished', status: report.status, developments: report.developments.length, properties: report.properties.length, uniqueImages: report.images.length, matches: report.metrics.matchedImages, errors: report.errors.length, output: folder }));
 } catch (error) {
  report.crawlProgress!.status='failed';report.crawlProgress!.currentDevelopments=[];await progress.update(site.slug,report,true);
  report.status = 'failed'; report.completedAt = new Date().toISOString();
  const message = error instanceof Error && /^(HTTP \d+|No development URLs found\.|robots.txt disallows crawling\.)$/.test(error.message) ? error.message : 'Source discovery failed; no negative classification inferred.';
  report.errors.push({url:site.sitemap,stage:'source',message});
  await writeReport(folder,report);
  console.log(JSON.stringify({stage:'finished',developer:site.name,status:report.status,errors:report.errors.length,output:folder}));
  throw error;
 } finally { await progress.close();if (sql) await sql.end(); await lock.close(); const { unlink } = await import('node:fs/promises'); await unlink(folder + '/.lock'); }
}
main().catch(error => { console.error(error instanceof Error && /^(Set GEMINI|All-images|Only Bellway|Invalid crawl|Output must|This output|Development is|No development|robots.txt)/.test(error.message) ? error.message : 'Crawl failed; credentials and raw provider responses withheld.'); process.exitCode = 1; });
