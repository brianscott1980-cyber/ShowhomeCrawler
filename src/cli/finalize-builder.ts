import {hasSiteCategorisation} from '../vision/site-categorisation.js';
import { isInferredAnalysis } from '../vision/analysis-provenance.js';
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

  const mapMatch = html.match(/mapLocation\([^,]+,\s*['"](-?\d+\.\d+)['"],\s*['"](-?\d+\.\d+)['"]\)/);
  if (mapMatch) {
    const lat = Number(mapMatch[1]), lon = Number(mapMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= 49 && lat <= 61.2 && lon >= -9 && lon <= 3) {
      return { latitude: lat, longitude: lon };
    }
  }

  const locVarMatch = html.match(/var\s+location\s*=\s*\{\s*lat:\s*(-?\d+\.\d+),\s*lng:\s*(-?\d+\.\d+)\s*\}/);
  if (locVarMatch) {
    const lat = Number(locVarMatch[1]), lon = Number(locVarMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= 49 && lat <= 61.2 && lon >= -9 && lon <= 3) {
      return { latitude: lat, longitude: lon };
    }
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

  for (const el of $('[data-lat]').toArray()) {
    const latitude = Number($(el).attr('data-lat'));
    const longitude = Number($(el).attr('data-lon') ?? $(el).attr('data-lng') ?? $(el).attr('data-long'));
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

async function finalizeBuilder(builderSlug: string, persist = false) {
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

  // Publication requires completed visual analysis; never manufacture missing verdicts.
  if (existsSync(resolve(sourceFolder, '.lock'))) throw new Error('A crawl or classification is still running.');
  if (!report.images.length) throw new Error('No images collected.');
  if (report.images.some(img => !hasSiteCategorisation(img)&&(!img.verdict || !img.categorisation || isInferredAnalysis(img.verdict)))) {
    throw new Error('Run results:classify --all-images to complete genuine image analysis before finalizing.');
  }
  for (const img of report.images) {
    if (!/^images\/[a-f0-9]{64}\.(jpg|jpeg|png|webp|avif|gif|tiff)$/.test(img.path)) throw new Error('Invalid image path');
    await access(resolve(sourceFolder, img.path));
  }
  report.status = report.errors.length || report.metrics.propertyLimitOmissions || report.metrics.imageLimitOmissions || report.metrics.developmentLimitOmissions ? 'completed_with_gaps' : 'completed';
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
    if (!('latitude' in loc) && !loc.postcode) {
      const home = homesWithImages.find(p => p.developmentUrl === devUrl && p.url !== devUrl);
      if (home) {
        const homeHtml = await readFile(`results/.cache/pages/${sha256(home.url)}.html`, 'utf8').catch(() => '');
        loc = extractLocation(homeHtml, home.url);
      }
    }

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
    let scope = 'Advertised homes';
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
      scope = 'Published homes';
    }

    const loc = entries.find(e => e.url === devUrl);
    let country: string | null = devUrl.includes('/north-wales/') ? 'Wales' : devUrl.includes('/north-west/') ? 'England' : null;
    if (!country && loc?.latitude && loc?.longitude) {
      try {
        const response = await fetch(`https://api.postcodes.io/postcodes?lon=${loc.longitude}&lat=${loc.latitude}&radius=2000&limit=1`, {signal:AbortSignal.timeout(5000)});
        const data = await response.json() as any;
        if (response.ok) country = data.result?.[0]?.country ?? null;
      } catch {}
    }
    details.push({
      url: devUrl,
      country,
      scope,
      properties: [...new Map(properties.map(p => [p.identity, p])).values()].map(({ identity, ...p }) => p)
    });
  }

  await writeFile(siteDetailsFile, JSON.stringify(details, null, 2) + '\n');
  console.log(`site-details.json: ${details.length} sites recorded.`);

  // 7. Sync to database if available
  if (persist && process.env.DATABASE_URL) {
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
  const { values } = parseArgs({ options: { builder: { type: 'string' }, persist: {type:'boolean'} } });
  if (!values.builder) throw new Error('--builder slug required (e.g. --builder bovis-homes)');
  await finalizeBuilder(values.builder, values.persist);
}

main().catch(err => {
  console.error('Finalize error:', err);
  process.exitCode = 1;
});
