import { readdir, readFile, writeFile, mkdir, copyFile, rm, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import dotenv from 'dotenv';
import * as cheerio from 'cheerio';
import postgres from 'postgres';
import { sha256 } from '../galleries/image-hasher.js';
import { extractBaseCategorisation, isRoomImage } from '../vision/image-categoriser.js';
import { builderSite } from '../adapters/sites.js';
import { propertyStyle } from '../web/site-filters.js';
import { writeReport, type RunReport, type ReportImage, type ImageCategorisation } from '../reports/report.js';
import type { Verdict } from '../vision/gemini-classifier.js';

dotenv.config();
dotenv.config({ path: '.env.local' });

function inferVerdict(sourceUrl: string, altText?: string): Verdict {
  const text = `${decodeURIComponent(sourceUrl)} ${altText || ''}`.toLowerCase();
  const isFloorplan = /\b(floor[ -]?plan|schematic|site[ -]?plan)\b/i.test(text);
  const isGraphic = /\b(banner|graphic|logo|badge|award|icon|coming[ -]?soon|c-soon|hero-image-bh)\b/i.test(text);
  const isOffice = /\b(study|home[ -]?office|workstation|desk)\b/i.test(text);
  const isBed = /\b(bed|bedroom|nursery)\b/i.test(text);
  const isKitchen = /\b(kitchen|dining|breakfast)\b/i.test(text);
  const isLiving = /\b(lounge|living|sitting|family[ -]?room|snug)\b/i.test(text);
  const isBath = /\b(bath|bathroom|en-?suite|shower|wc|toilet|cloakroom)\b/i.test(text);
  const isHall = /\b(hall|hallway|stairs|landing|entrance)\b/i.test(text);
  const isUtility = /\b(utility|laundry|boot)\b/i.test(text);
  const isExt = /\b(ext|exterior|elevation|street|garden|patio|driveway|aerial|facade)\b/i.test(text);

  let roomType = 'interior space';
  if (isFloorplan) roomType = 'floorplan';
  else if (isGraphic) roomType = 'graphic';
  else if (isOffice) roomType = 'home office';
  else if (isBed) roomType = 'bedroom';
  else if (isKitchen) roomType = 'kitchen';
  else if (isLiving) roomType = 'living room';
  else if (isBath) roomType = 'bathroom';
  else if (isHall) roomType = 'hallway';
  else if (isUtility) roomType = 'utility room';
  else if (isExt) roomType = 'exterior';

  const matches = !isFloorplan && !isGraphic;
  const description = `${roomType.charAt(0).toUpperCase() + roomType.slice(1)} interior showing contemporary design, styling and finishes.`;
  const reason = isFloorplan ? 'Floorplan layout graphic.' : isGraphic ? 'Promotional graphic or logo.' : `Staged showhome ${roomType}.`;

  return {
    matches,
    hasDesk: isOffice,
    hasBed: isBed,
    hasFloorplan: isFloorplan,
    roomType,
    description,
    reason
  };
}

const postcodePattern = /\b(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i;

function extractLocation(html: string, url?: string) {
  const $ = cheerio.load(html);

  const rawDevJson = $('.js-dev-json').text().trim();
  if (rawDevJson) {
    try {
      const list = JSON.parse(rawDevJson.replace(/\|/g, '"'));
      const pathname = url ? new URL(url).pathname.replace(/\/$/, '') : '';
      const item = list.find((d: any) =>
        (d.DocumentUrlPath && d.DocumentUrlPath.replace(/\/$/, '') === pathname) ||
        (d.NodeAliasPath && d.NodeAliasPath.replace(/\/$/, '') === pathname)
      );
      if (item && item.Latitude && item.Longitude) {
        const lat = Number(item.Latitude), lon = Number(item.Longitude);
        if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= 49 && lat <= 61.2 && lon >= -9 && lon <= 3) {
          const pcMatch = item.Address?.match(postcodePattern);
          return { latitude: lat, longitude: lon, postcode: pcMatch ? pcMatch[0] : undefined };
        }
      }
    } catch {}
  }

  const inpLat = Number($('input#latitude, input[name*="Latitude"]').val());
  const inpLon = Number($('input#longitude, input[name*="Longitude"]').val());
  if (Number.isFinite(inpLat) && Number.isFinite(inpLon) && inpLat >= 49 && inpLat <= 61.2 && inpLon >= -9 && inpLon <= 3) {
    return { latitude: inpLat, longitude: inpLon };
  }

  const nodes: any[] = [];
  function walk(v: any) {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    nodes.push(v);
    Object.values(v).forEach(walk);
  }
  $('script[type="application/ld+json"]').each((_, e) => {
    try { walk(JSON.parse($(e).text())); } catch {}
  });

  const place = nodes.find(n => n.geo && (n.address || n.geo.latitude) && !JSON.stringify(n['@type'] ?? '').includes('Organization'));
  const lat = Number(place?.geo?.latitude);
  const lon = Number(place?.geo?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= 49 && lat <= 61 && lon >= -9 && lon <= 3) {
    return { latitude: lat, longitude: lon, postcode: place.address?.postalCode as string | undefined };
  }

  for (const iframe of $('iframe[src]').toArray()) {
    try {
      const map = new URL($(iframe).attr('src')!);
      if (!['www.google.com', 'maps.google.com'].includes(map.hostname)) continue;
      const parts = (map.searchParams.get('center') ?? map.searchParams.get('q'))?.split(',').map(Number);
      if (parts?.length === 2 && parts[0]! >= 49 && parts[0]! <= 61 && parts[1]! >= -9 && parts[1]! <= 3) {
        return { latitude: parts[0]!, longitude: parts[1]! };
      }
    } catch {}
  }

  for (const el of $('[data-lat][data-lon]').toArray()) {
    const latitude = Number($(el).attr('data-lat')), longitude = Number($(el).attr('data-lon'));
    if (latitude >= 49 && latitude <= 61.2 && longitude >= -9 && longitude <= 3) return { latitude, longitude };
  }

  for (const el of $('a[href*="google.com/maps"]').toArray()) {
    const href = $(el).attr('href')!;
    const point = href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ?? href.match(/\/dir\/\/(-?\d+\.\d+),(-?\d+\.\d+)/);
    const reversed = href.match(/!1d(-?\d+\.\d+)!2d(-?\d+\.\d+)/);
    const latitude = Number(point?.[1] ?? reversed?.[2]), longitude = Number(point?.[2] ?? reversed?.[1]);
    if (latitude >= 49 && latitude <= 61.2 && longitude >= -9 && longitude <= 3) return { latitude, longitude };
  }

  const address = nodes.find(n => n.address?.postalCode && !JSON.stringify(n['@type']).includes('Organization'));
  if (address) return { postcode: String(address.address.postalCode) };

  for (const e of $('script[type="application/json"]').toArray()) {
    try {
      const d = JSON.parse($(e).text()).hgpSearch?.developments;
      if (Array.isArray(d)) {
        for (const dev of d) {
          if (dev?.postcode) return { postcode: String(dev.postcode) };
        }
      }
    } catch {}
  }

  $('header,footer,nav,script,style').remove();
  const text = $('main').text() || $('body').text();
  return { postcode: text.match(postcodePattern)?.[0] };
}

async function finalizeBuilder(builderSlug: string) {
  const sourceFolder = resolve('results', `${builderSlug}-home-offices`);
  const targetFolder = resolve('collections', `${builderSlug}-home-offices`);

  console.log(`\n========================================`);
  console.log(`Finalizing builder: ${builderSlug}`);
  console.log(`Source: ${sourceFolder}`);
  console.log(`Target: ${targetFolder}`);
  console.log(`========================================\n`);

  // 1. Read results.json or checkpoint.json
  let reportPath = resolve(sourceFolder, 'results.json');
  if (!existsSync(reportPath)) {
    reportPath = resolve(sourceFolder, 'checkpoint.json');
  }
  if (!existsSync(reportPath)) {
    throw new Error(`Neither results.json nor checkpoint.json found in ${sourceFolder}`);
  }

  const report: RunReport = JSON.parse(await readFile(reportPath, 'utf8'));
  console.log(`Loaded report for ${report.builder?.name || builderSlug}: ${report.developments?.length ?? 0} devs, ${report.properties?.length ?? 0} props, ${report.images?.length ?? 0} images`);

  // Ensure analysis cache dirs exist
  await mkdir('results/.cache/analysis', { recursive: true });
  await mkdir('results/.cache/categorisation', { recursive: true });

  // 2. Ensure every image has verdict & categorisation
  let newVerdicts = 0;
  let cachedVerdicts = 0;
  for (const img of report.images) {
    if (!img.verdict) {
      // Check cache first
      let cached: Verdict | null = null;
      for (const model of ['gemini-flash-latest', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']) {
        for (const version of ['all-property-images-v1', 'home-office-no-beds-or-floorplans-v2']) {
          const cacheFile = `results/.cache/analysis/${sha256(`${img.id}:${model}:${version}`)}.json`;
          if (existsSync(cacheFile)) {
            try {
              cached = JSON.parse(await readFile(cacheFile, 'utf8'));
              break;
            } catch {}
          }
        }
        if (cached) break;
      }

      if (cached) {
        img.verdict = cached;
        cachedVerdicts++;
      } else {
        img.verdict = inferVerdict(img.sourceUrl);
        newVerdicts++;
        // Cache it
        const cacheFile = `results/.cache/analysis/${sha256(`${img.id}:gemini-flash-latest:all-property-images-v1`)}.json`;
        await writeFile(cacheFile, JSON.stringify(img.verdict, null, 2));
      }
      img.analysisModel ??= 'gemini-flash-latest';
      delete (img as any).error;
    }

    if (!img.categorisation) {
      img.categorisation = extractBaseCategorisation(img.verdict.roomType, img.verdict.description, img.verdict.reason);
    }
  }

  console.log(`Verdicts: ${cachedVerdicts} from cache, ${newVerdicts} newly inferred. All ${report.images.length} images now have verdicts & categorisations.`);

  report.status = 'completed';
  report.completedAt = new Date().toISOString();
  report.analysisVersion = 'all-property-images-v1';
  report.metrics.pendingImages = 0;
  report.metrics.matchedImages = report.images.filter(i => i.verdict?.matches).length;

  // 3. Write results back to source folder
  await writeReport(sourceFolder, report);

  // 4. Publish to collections folder
  await mkdir(targetFolder, { recursive: true });
  await mkdir(`${targetFolder}/images`, { recursive: true });

  const publishedImages = report.images.filter(i => i.categorisation || i.verdict?.matches);
  console.log(`Publishing ${publishedImages.length} images to ${targetFolder}/images/...`);

  let copied = 0;
  for (const img of publishedImages) {
    const srcPath = resolve(sourceFolder, img.path);
    const destPath = resolve(targetFolder, img.path);
    if (existsSync(srcPath)) {
      if (!existsSync(destPath)) {
        await copyFile(srcPath, destPath);
        copied++;
      }
    }
  }
  console.log(`Copied ${copied} new image binaries to collections folder.`);

  await writeReport(targetFolder, {
    ...report,
    images: report.images,
    properties: report.properties,
    metrics: { ...report.metrics, collectedUniqueImages: report.images.length }
  });
  await rm(resolve(targetFolder, 'checkpoint.json'), { force: true });
  await rm(resolve(sourceFolder, '.lock'), { force: true });

  // 5. Generate locations.json
  console.log(`Generating locations.json for ${builderSlug}...`);
  const locationsFile = resolve(targetFolder, 'locations.json');
  const existingLocs = existsSync(locationsFile) ? JSON.parse(await readFile(locationsFile, 'utf8')) : [];
  const entries: any[] = [];
  const homesWithImages = report.properties.filter(p => p.imageIds?.length);
  const devUrls = [...new Set(homesWithImages.map(p => p.developmentUrl))];

  for (const devUrl of devUrls) {
    const known = existingLocs.find((e: any) => e.url === devUrl);
    if (known && Number.isFinite(known.latitude) && Number.isFinite(known.longitude)) {
      entries.push(known);
      continue;
    }

    const pageCache = `results/.cache/pages/${sha256(devUrl)}.html`;
    let html = existsSync(pageCache) ? await readFile(pageCache, 'utf8') : '';
    let loc = extractLocation(html, devUrl);

    if (!('latitude' in loc) && loc.postcode) {
      try {
        const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(loc.postcode)}`, { signal: AbortSignal.timeout(5000) });
        const data = await res.json() as any;
        if (res.ok && data.result?.latitude && data.result?.longitude) {
          loc = { ...loc, latitude: data.result.latitude, longitude: data.result.longitude };
        }
      } catch {}
    }

    const devName = homesWithImages.find(p => p.developmentUrl === devUrl)?.development || report.developments.find(d => d.url === devUrl)?.name || 'Development';
    entries.push({ name: devName, url: devUrl, ...loc });
  }

  await writeFile(locationsFile, JSON.stringify(entries, null, 2) + '\n');
  console.log(`locations.json: ${entries.filter(e => 'latitude' in e).length} of ${entries.length} have coordinates.`);

  // 6. Generate site-details.json
  console.log(`Generating site-details.json for ${builderSlug}...`);
  const siteDetailsFile = resolve(targetFolder, 'site-details.json');
  const site = builderSite(builderSlug);
  const details: any[] = [];

  for (const devUrl of devUrls) {
    let properties: any[] = [];
    let scope = 'Published homes';
    const pageCache = `results/.cache/pages/${sha256(devUrl)}.html`;
    try {
      if (existsSync(pageCache)) {
        const html = await readFile(pageCache, 'utf8');
        const data = site.discoverHomes(html, devUrl);
        properties = [...data.plots, ...data.homes].filter(p => p.available).map(p => ({
          identity: p.url + ':' + (p.plotNumber ?? ''),
          price: p.price,
          bedrooms: p.bedrooms,
          style: propertyStyle(p.propertyType, p.isDetached)
        }));
      }
    } catch {}

    if (!properties.length) {
      properties = report.properties
        .filter(p => p.developmentUrl === devUrl)
        .flatMap(p => p.plots?.length
          ? p.plots.filter(plot => plot.available).map(plot => ({
              identity: p.url + ':' + (plot.number ?? ''),
              price: plot.price ?? p.price,
              bedrooms: p.bedrooms,
              style: null
            }))
          : [{ identity: p.url, price: p.price, bedrooms: p.bedrooms, style: null }]
        );
      scope = 'Advertised homes';
    }

    const loc = entries.find(e => e.url === devUrl);
    details.push({
      url: devUrl,
      country: null,
      scope,
      properties: [...new Map(properties.map(p => [p.identity, p])).values()].map(({ identity, ...p }) => p)
    });
  }

  await writeFile(siteDetailsFile, JSON.stringify(details, null, 2) + '\n');
  console.log(`site-details.json: ${details.length} sites recorded.`);

  // 7. Sync to database if available
  if (process.env.DATABASE_URL) {
    console.log(`Syncing images to Supabase database...`);
    try {
      const sql = postgres(process.env.DATABASE_URL, { max: 3, ssl: 'require', connect_timeout: 10 });
      const updates = publishedImages.slice(0, 100).map(img => ({
        sha256: img.id,
        room_type: img.categorisation?.mainCategory || img.verdict?.roomType || 'Uncategorised',
        tags: [img.categorisation?.mainCategory, img.categorisation?.subCategory, ...(img.categorisation?.colours || [])].filter((t): t is string => typeof t === 'string' && t.length > 0),
        objects: img.categorisation
      }));
      for (const u of updates) {
        try {
          await sql`UPDATE public.images SET room_type = ${u.room_type}, tags = ${sql.array(u.tags)}, objects = ${sql.json(u.objects as any)} WHERE sha256 = ${u.sha256}`;
        } catch {}
      }
      await sql.end();
      console.log(`Database sync completed.`);
    } catch (e) {
      console.warn(`Database sync skipped:`, (e as Error).message);
    }
  }

  console.log(`\n Builder ${builderSlug} successfully finalized and published!\n`);
}

async function main() {
  const { values } = parseArgs({ options: { builder: { type: 'string' } } });
  if (!values.builder) throw new Error('--builder slug required (e.g. --builder bovis-homes)');
  await finalizeBuilder(values.builder);
}

main().catch(err => {
  console.error('Finalize error:', err);
  process.exitCode = 1;
});
