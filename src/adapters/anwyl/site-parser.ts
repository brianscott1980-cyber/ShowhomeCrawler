import { load } from 'cheerio';
import type { PropertyCandidate, GalleryImageCandidate } from '../../models/domain.js';

const origin = 'https://www.anwylhomes.co.uk';

export function developmentUrls(content: string): string[] {
  const isXml = content.trimStart().startsWith('<?xml') || content.includes('<urlset') || content.includes('<sitemapindex');
  const $ = load(content, isXml ? { xmlMode: true } : {});
  const urls = new Set<string>();

  if (isXml) {
    $('url > loc, sitemap > loc').each((_, el) => {
      const text = $(el).text().trim();
      try {
        const url = new URL(text);
        if (url.origin !== origin) return;
        const parts = url.pathname.split('/').filter(Boolean);
        // /our-developments/<dev-slug>/
        if (parts.length === 2 && parts[0] === 'our-developments') {
          if (!parts[1]!.includes('%') && parts[1] !== 'our-developments') {
            urls.add(`${origin}/our-developments/${parts[1]}/`);
          }
        }
      } catch {}
    });
  } else {
    $('a[href*="/our-developments/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const url = new URL(href, origin);
        if (url.origin !== origin) return;
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length === 2 && parts[0] === 'our-developments') {
          if (!parts[1]!.includes('%') && parts[1] !== 'our-developments') {
            urls.add(`${origin}/our-developments/${parts[1]}/`);
          }
        }
      } catch {}
    });
  }

  return [...urls];
}

export async function enrichPage(html: string, fetchText: (url: string) => Promise<string>): Promise<string> {
  const $ = load(html);
  const devId = $('[data-development-id]').first().attr('data-development-id');
  
  try {
    let json = '';
    if (devId) {
      json = await fetchText(`${origin}/wp-json/anwyl/v1/house-types?development=${devId}`);
    }
    if (!json || json === '[]' || json.length < 5) {
      json = await fetchText(`${origin}/wp-json/anwyl/v1/house-types`);
    }
    if (json && json.startsWith('[')) {
      return html + `<script type="application/json" id="anwyl-house-types">${json.replace(/</g, '\\u003c')}</script>`;
    }
  } catch {
    // If API fetch fails, proceed with static HTML
  }
  return html;
}

export function discoverHomes(html: string, url: string) {
  const $ = load(html);
  
  // Extract development name
  let name = '';
  const title = $('title').text().trim();
  if (title) {
    const parts = title.split(/ \| | - /);
    const candidate = parts[0]?.replace(/^[-–—\s]+|[-–—\s]+$/g, '').trim() || '';
    if (candidate && !/anwyl homes|new homes/i.test(candidate)) {
      name = candidate;
    }
  }
  if (!name) {
    const h1 = $('h1').first().text().trim();
    if (h1 && !/anwyl|welcome|new homes/i.test(h1)) {
      name = h1.split(',')[0]!.trim();
    }
  }
  if (!name) {
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
    name = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // Extract coordinates if present
  let latitude: number | undefined;
  let longitude: number | undefined;
  const mapEl = $('#anwyl-location-map, [data-lat]').first();
  if (mapEl.length) {
    const lat = Number(mapEl.attr('data-lat'));
    const lng = Number(mapEl.attr('data-lng') || mapEl.attr('data-lon') || mapEl.attr('data-longitude'));
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= 49 && lat <= 61.2 && lng >= -9 && lng <= 3) {
      latitude = lat;
      longitude = lng;
    }
  }

  const homes: PropertyCandidate[] = [];
  const seen = new Set<string>();
  const devSlug = new URL(url).pathname.split('/').filter(Boolean).pop() || '';

  // 1. Check for enriched house-types JSON
  const scriptData = $('script#anwyl-house-types').text().trim();
  if (scriptData) {
    try {
      const items = JSON.parse(scriptData);
      if (Array.isArray(items)) {
        for (const item of items) {
          const permalink = item.permalink;
          if (!permalink) continue;

          let targetUrl: string;
          try {
            targetUrl = new URL(permalink, origin).href;
          } catch {
            continue;
          }

          // Check if this house belongs to the current development
          const targetSlug = new URL(targetUrl).pathname.split('/').filter(Boolean);
          const belongsToDev = (targetSlug.length >= 2 && targetSlug[1] === devSlug) ||
                               (item.development && String(item.development) === $('[data-development-id]').first().attr('data-development-id'));
          if (!belongsToDev) continue;

          if (seen.has(targetUrl)) continue;
          seen.add(targetUrl);

          const rawName = String(item.name || '').trim();
          let houseName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : 'Home';
          if (!houseName.toLowerCase().startsWith('the ')) {
            houseName = `The ${houseName}`;
          }

          let bedrooms: number | null = null;
          if (item.num_bedrooms && typeof item.num_bedrooms === 'object' && item.num_bedrooms.name) {
            const b = parseInt(item.num_bedrooms.name, 10);
            if (Number.isInteger(b) && b > 0) bedrooms = b;
          }
          if (bedrooms === null && item.description) {
            const m = String(item.description).match(/(\d+)\s*bed/i);
            if (m) bedrooms = parseInt(m[1]!, 10);
          }

          let price: number | null = null;
          if (item.from_price && Number(item.from_price) > 0) {
            price = Number(item.from_price);
          } else if (item.price) {
            const m = String(item.price).match(/£?\s*([\d,]+)/);
            if (m) {
              const p = Number(m[1]!.replace(/,/g, ''));
              if (Number.isFinite(p) && p > 10000) price = p;
            }
          }

          const dwelling = String(item.dwelling_type || '').toLowerCase();
          const propertyType = dwelling.includes('apartment') || dwelling.includes('flat') ? 'apartment' : 'house';
          const isDetached = dwelling.includes('detached') && !dwelling.includes('semi') ? true :
                             dwelling.includes('semi') ? false : null;
          const isSold = String(item.availability || '').toLowerCase() === 'sold';

          homes.push({
            externalId: new URL(targetUrl).pathname,
            houseTypeExternalId: (rawName || 'home').toLowerCase().replace(/\W+/g, '-'),
            name: houseName,
            url: targetUrl,
            bedrooms,
            price,
            propertyType,
            isDetached,
            available: !isSold,
            status: isSold ? 'sold' : 'available'
          });
        }
      }
    } catch {}
  }

  // 2. Fallback: Parse card links from HTML if JSON had no matching homes
  if (homes.length === 0) {
    $('a[href*="/our-developments/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const u = new URL(href, url);
        if (u.origin !== origin) return;
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length === 3 && parts[0] === 'our-developments' && parts[1] === devSlug) {
          if (seen.has(u.href)) return;
          seen.add(u.href);

          const card = $(el).closest('article, .house-type-card, [class*="house"], div');
          const cardText = card.text().replace(/\s+/g, ' ').trim();
          const houseSlug = parts[2]!;
          let houseName = houseSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          if (!houseName.toLowerCase().startsWith('the ')) {
            houseName = `The ${houseName}`;
          }

          const bedMatch = cardText.match(/(\d+)\s*bed/i);
          const bedrooms = bedMatch ? parseInt(bedMatch[1]!, 10) : null;

          const priceMatch = cardText.match(/£\s*([\d,]+)/);
          const price = priceMatch ? Number(priceMatch[1]!.replace(/,/g, '')) : null;

          homes.push({
            externalId: u.pathname,
            houseTypeExternalId: houseSlug.toLowerCase(),
            name: houseName,
            url: u.href,
            bedrooms,
            price,
            propertyType: /apartment|flat/i.test(cardText) ? 'apartment' : 'house',
            isDetached: /detached/i.test(cardText) && !/semi/i.test(cardText) ? true : /semi/i.test(cardText) ? false : null,
            available: !/sold/i.test(cardText),
            status: /sold/i.test(cardText) ? 'sold' : 'available'
          });
        }
      } catch {}
    });
  }

  return {
    development: {
      name,
      url,
      ...(latitude && longitude ? { latitude, longitude } : {})
    },
    homes,
    plots: homes,
    plotError: null
  };
}

export function galleryImages(html: string, _url?: string): GalleryImageCandidate[] {
  const $ = load(html);
  const images: GalleryImageCandidate[] = [];
  const seen = new Set<string>();

  const excludePattern = /(logo|icon|map|marker|nhqc|nhos|hbf|pglogo|anniversary|what3words|\.svg)/i;

  // 1. Check data-imageset attributes
  $('[data-imageset]').each((_, el) => {
    const raw = $(el).attr('data-imageset');
    if (!raw) return;
    try {
      const items = JSON.parse(raw);
      if (Array.isArray(items)) {
        for (const item of items) {
          if (!item.url || item.type === 'video') continue;
          let imgUrl = String(item.url);
          if (excludePattern.test(imgUrl)) continue;

          try {
            const absolute = new URL(imgUrl, origin).href;
            if (seen.has(absolute)) continue;
            seen.add(absolute);

            images.push({
              url: absolute,
              position: images.length,
              altText: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : undefined
            });
          } catch {}
        }
      }
    } catch {}
  });

  // 2. Fallback / supplement from img tags
  if (images.length === 0) {
    $('img').each((_, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (!src || src.startsWith('data:')) return;
      if (excludePattern.test(src)) return;
      if (!src.includes('/uploads/')) return;

      try {
        const absolute = new URL(src, origin).href;
        if (seen.has(absolute)) return;
        seen.add(absolute);

        let alt = $(el).attr('alt')?.trim();
        if (alt && excludePattern.test(alt)) alt = undefined;

        images.push({
          url: absolute,
          position: images.length,
          altText: alt || undefined
        });
      } catch {}
    });
  }

  return images;
}
