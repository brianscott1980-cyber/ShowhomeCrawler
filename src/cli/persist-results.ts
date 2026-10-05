import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { mapLimit } from '../crawler/request-client.js';
import { createDatabase } from '../database/postgres.js';
import { PostgresCatalogRepository } from '../database/repositories/postgres-catalog-repository.js';
import { builderSite } from '../adapters/sites.js';
import { sha256, imageIdentity } from '../galleries/image-hasher.js';
import type { RunReport } from '../reports/report.js';
let persistenceStage = 'setup';
async function main() {
 const { values } = parseArgs({ options: { folder: { type: 'string', default: 'results/bellway-home-offices' } } });
 const folder = values.folder;
 const report: RunReport = JSON.parse(await readFile(`${folder}/results.json`, 'utf8'));
 const sql = createDatabase();
 try {
  // Guard against accidentally connecting to the user's other application project.
  const { requireDatabaseUrl } = await import('../config/env.js');
  if (new URL(requireDatabaseUrl()).username !== 'postgres.hnxrbhlffwmlymxflrdb') throw new Error('Wrong project connection.');
  const site = builderSite(report.builder?.slug); const { discoverHomes } = site;
  const repo = new PostgresCatalogRepository(sql, site);
  const [builder] = await sql`insert into builders(name,slug,website_url) values (${site.name},${site.slug},${site.websiteUrl}) on conflict(slug) do update set name=excluded.name returning id`;
  const [job] = await sql`insert into crawl_jobs(builder_id, started_at, status, filter_config) values (${builder!.id}, ${report.startedAt}, 'running', ${sql.json({ imageQuestion: report.question, analysisVersion: report.analysisVersion ?? null })}) returning id`;
  try {
   persistenceStage = 'catalogue';
   await mapLimit(report.developments.filter(dev => dev.status !== 'failed'), 3, async dev => {
    const data = discoverHomes(await readFile(`results/.cache/pages/${sha256(dev.url)}.html`, 'utf8'), dev.url);
    const listings = [...data.plots, ...data.homes.filter(h => !data.plots.some(p => p.url === h.url))];
    await repo.saveDevelopment(data.development, listings.sort((a,b) => (a.houseTypeExternalId ?? a.name).localeCompare(b.houseTypeExternalId ?? b.name))); 
   });
   const ids = new Map<string, string>();
   let newImages = 0, newGalleries = 0, reusedGalleries = 0;
   persistenceStage = 'images';
   await mapLimit(report.images, 3, async image => {
    const identity = await imageIdentity(await readFile(`${folder}/${image.path}`));
    const [row] = await sql`insert into images(source_url, sha256, perceptual_hash, width, height, mime_type, room_type, description, ai_model, ai_analysis_version, ai_analysed_at)
     values (${image.sourceUrl}, ${identity.sha256}, ${identity.dhash}, ${identity.width}, ${identity.height}, ${'image/' + identity.format}, ${image.verdict?.roomType ?? null}, ${image.verdict?.description ?? null}, ${image.verdict ? image.analysisModel ?? report.model : null}, ${image.verdict ? report.analysisVersion ?? 'home-office-no-beds-v1' : null}, ${image.verdict ? report.completedAt ?? report.startedAt : null})
     on conflict(sha256) do update set room_type=coalesce(excluded.room_type, images.room_type), description=coalesce(excluded.description,images.description), ai_model=coalesce(excluded.ai_model,images.ai_model), ai_analysis_version=coalesce(excluded.ai_analysis_version,images.ai_analysis_version), ai_analysed_at=coalesce(excluded.ai_analysed_at,images.ai_analysed_at) returning id, (xmax = 0) as inserted`;
    if (row!.inserted) newImages++;
    ids.set(image.id, row!.id);
    if (image.verdict) await sql`insert into image_classifications(image_id,question,question_version,ai_model,matches,has_desk,has_bed,reason)
     values (${row!.id},${report.question},${report.analysisVersion ?? 'home-office-no-beds-v1'},${image.analysisModel ?? report.model},${image.verdict.matches},${image.verdict.hasDesk},${image.verdict.hasBed},${image.verdict.reason}) on conflict(image_id,question_version,ai_model) do nothing`;
   });
   const imageMap = new Map(report.images.map(i => [i.id, i]));
   persistenceStage = 'galleries';
   for (const property of report.properties) {
    if (!property.imageIds.length) continue;
    const linked = await sql`select property_listings.id, house_type_id from property_listings join developments on developments.id=property_listings.development_id where developments.url=${property.developmentUrl} and property_listings.url=${property.url}`;
    if (!linked.length) throw new Error('Listing link missing.');
    const first = property.imageIds[0]!;
    const fingerprint = sha256(JSON.stringify([...property.imageIds].sort()));
    await sql.begin(async tx => {
     const [gallery] = await tx`insert into galleries(builder_id,house_type_id,fingerprint,identity_version,first_image_sha256,image_count)
      values (${builder!.id},${linked[0]!.house_type_id},${fingerprint},'sha256-set-v1',${first},${property.imageIds.length}) on conflict(builder_id,identity_version,fingerprint) do update set updated_at=now() returning id, (xmax = 0) as inserted`;
     if (gallery!.inserted) newGalleries++; else reusedGalleries++;
     const orderedImages = property.imageIds.map((imageId,position) => ({ image_id: ids.get(imageId)!, position, source_url: imageMap.get(imageId)!.sourceUrl }));
     await tx`insert into gallery_images(gallery_id,image_id,position,source_url)
      select ${gallery!.id}::uuid,image_id,position,source_url from jsonb_to_recordset(${sql.json(orderedImages)}) as item(image_id uuid,position integer,source_url text)
      on conflict(gallery_id,position) do nothing`;
     const listingIds = linked.map(listing => ({ id:listing.id }));
     await tx`insert into property_galleries(property_listing_id,gallery_id)
      select id,${gallery!.id}::uuid from jsonb_to_recordset(${sql.json(listingIds)}) as item(id uuid) on conflict do nothing`;

    });
   }
   persistenceStage = 'crawl_items';
   const items = [
    ...report.developments.map(dev => ({ url:dev.url,item_type:'development',item_key:dev.url,status:dev.status === 'failed' ? 'failed' : 'complete',last_error:dev.error ?? null,payload:{ warning:dev.warning ?? null } })),
    ...report.images.map(image => ({ url:image.sourceUrl,item_type:'image',item_key:image.id,status:image.verdict ? 'complete' : 'failed',last_error:image.error ?? null,payload:{} }))
   ];
   await sql`insert into crawl_items(crawl_job_id,url,item_type,item_key,status,last_error,payload)
    select ${job!.id}::uuid,url,item_type,item_key,status,last_error,payload
    from jsonb_to_recordset(${sql.json(items)}) as item(url text,item_type text,item_key text,status text,last_error text,payload jsonb)`;
   await sql`update crawl_jobs set completed_at=${report.completedAt ?? new Date().toISOString()}, status=${report.status === 'cancelled' ? 'cancelled' : report.status === 'completed' ? 'completed' : 'completed_with_errors'}, developments_discovered=${report.developments.length}, properties_discovered=${report.developments.reduce((sum,d) => sum+(d.homes ?? 0),0)}, properties_matched=${report.properties.length}, new_images=${newImages}, new_galleries=${newGalleries}, reused_galleries=${reusedGalleries}, errors_count=${report.errors.length} where id=${job!.id}`;
   const receipt = { persisted: true, project: 'hnxrbhlffwmlymxflrdb', jobId: job!.id, uniqueImages: ids.size, newImages, newGalleries, reusedGalleries, persistedAt: new Date().toISOString() };
   await writeFile(`${folder}/database.json`, JSON.stringify(receipt, null, 2));
   console.log(JSON.stringify(receipt));
  } catch (error) { await sql`update crawl_jobs set status='failed', errors_count=1, completed_at=now() where id=${job!.id}`; throw error; }
 } finally { await sql.end(); }
}
main().catch(() => { console.error('Result persistence failed; credentials withheld.'); process.exitCode=1; });
