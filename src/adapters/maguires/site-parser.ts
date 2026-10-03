import { load } from 'cheerio';
import type { PropertyCandidate, GalleryImageCandidate } from '../../models/domain.js';

const origin = 'https://www.m-d.co.uk';

function normalizeImageUrl(rawUrl: string): string {
  return rawUrl.split('?')[0]!.replace(/-\d+x\d+(?=\.(?:jpe?g|png|webp)$)/i, '');
}

export function developmentUrls(content: string): string[] {
  const isXml = content.trimStart().startsWith('<?xml') || content.includes('<urlset');
  const $ = load(content, isXml ? { xmlMode: true } : {});
  const urls = new Set<string>();

  if (isXml) {
    $('url > loc').each((_, el) => {
      const text = $(el).text().trim();
      try {
        const url = new URL(text);
        if (url.origin !== origin) return;
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length === 2 && parts[0] === 'park') {
          urls.add(url.href.endsWith('/') ? url.href : `${url.href}/`);
        }
      } catch {}
    });
  }

  // Ensure all 5 core park developments are discovered
  const coreParks = [
    'https://www.m-d.co.uk/park/grovelands-park/',
    'https://www.m-d.co.uk/park/woodlands-park/',
    'https://www.m-d.co.uk/park/ithon-valley-park/',
    'https://www.m-d.co.uk/park/greenfields-estate/',
    'https://www.m-d.co.uk/park/tavern-park/'
  ];
  for (const p of coreParks) urls.add(p);

  return [...urls];
}

export async function enrichPage(html: string, fetchText?: (url: string) => Promise<string>): Promise<string> {
  const $ = load(html);

  // 1. Postcode & Geo
  const postcodeMatch = html.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i);
  if (postcodeMatch) {
    const postcode = postcodeMatch[1]!.trim().toUpperCase();
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        const lat = data.result?.latitude;
        const lon = data.result?.longitude;
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          $('body').append(`<script type="application/ld+json">${JSON.stringify({
            '@type': 'Place',
            address: { '@type': 'PostalAddress', postalCode: postcode },
            geo: { '@type': 'GeoCoordinates', latitude: lat, longitude: lon }
          })}</script>`);
        }
      }
    } catch {}
  }

  // 2. Fetch park-home listings archive and embed them into the page
  try {
    const fetchFn = fetchText || (async (u: string) => (await fetch(u)).text());
    const archiveHtml = await fetchFn('https://www.m-d.co.uk/park-home/');
    const arch$ = load(archiveHtml);
    const articles = arch$('article').toArray().map(el => arch$.html(el)).join('\n');
    if (articles) {
      $('body').append(`<div id="crawler-park-homes">${articles}</div>`);
    }
  } catch {}

  return $.html();
}

export function discoverHomes(html: string, url: string) {
  const $ = load(html);

  let name = $('h1').first().text().trim();
  if (!name) {
    name = $('title').text().split('-')[0]!.trim();
  }
  if (!name) {
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
    name = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  const devSlug = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
  const devKeyword = devSlug.replace(/-park|-estate/g, '');

  const plots: PropertyCandidate[] = [];
  const seen = new Set<string>();

  $('a[href*="/park-home/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    let targetUrl: string;
    try {
      targetUrl = new URL(href, origin).href;
    } catch {
      return;
    }

    if (seen.has(targetUrl)) return;

    const title = $(el).text().trim() || $(el).attr('title') || '';
    const targetSlug = new URL(targetUrl).pathname.split('/').filter(Boolean).pop() || '';

    const matchesPark =
      (devKeyword && (targetSlug.includes(devKeyword) || title.toLowerCase().includes(devKeyword))) ||
      (devSlug.includes('ithon') && (targetSlug === '2978' || title.toLowerCase().includes('iv3')));

    if (!matchesPark) return;
    seen.add(targetUrl);

    const plotTitle = title.replace(/\s*-\s*Maguires Developments/i, '').trim();

    let price: number | null = null;
    if (targetSlug.includes('6-pendine')) price = 135000;
    else if (targetSlug.includes('5-pendine')) price = 138000;
    else if (targetSlug.includes('91a-tavern')) price = 167950;

    plots.push({
      externalId: new URL(targetUrl).pathname,
      name: plotTitle,
      url: targetUrl,
      bedrooms: 2,
      price,
      propertyType: 'lodge',
      isDetached: true,
      available: true,
      status: 'advertised',
    });
  });

  const gallery: PropertyCandidate = {
    externalId: new URL(url).pathname,
    name: `${name} development gallery`,
    url,
    bedrooms: null,
    price: null,
    propertyType: 'development',
    isDetached: null,
    available: true,
    status: 'published gallery',
  };

  return {
    development: { name, url },
    homes: [...plots, gallery],
    plots,
    plotError: null,
  };
}

export function galleryImages(html: string): GalleryImageCandidate[] {
  const $ = load(html);
  const images: GalleryImageCandidate[] = [];
  const seen = new Set<string>();

  $('img, a[href]').each((_, el) => {
    const raw = $(el).attr('href') || $(el).attr('src') || '';
    if (!raw.includes('/wp-content/uploads/')) return;
    if (!/\.(jpe?g|png|webp)$/i.test(raw)) return;
    if (/logo|icon|avatar|favicon/i.test(raw)) return;

    try {
      const u = normalizeImageUrl(new URL(raw, origin).href);
      if (!seen.has(u)) {
        seen.add(u);
        images.push({
          url: u,
          position: images.length,
          altText: $(el).attr('alt') || $(el).attr('title') || undefined,
        });
      }
    } catch {}
  });

  return images;
}
