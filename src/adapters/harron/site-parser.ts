import { load } from 'cheerio';
import type { PropertyCandidate, GalleryImageCandidate } from '../../models/domain.js';

const origin = 'https://www.harronhomes.com';

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
        // /find-a-home/<region>/<dev-slug>/
        if (parts.length === 3 && parts[0] === 'find-a-home') {
          urls.add(`${origin}/${parts.join('/')}/`);
        }
      } catch {}
    });
  } else {
    $('a[href*="/find-a-home/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const url = new URL(href, origin);
        if (url.origin !== origin) return;
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length === 3 && parts[0] === 'find-a-home') {
          urls.add(`${origin}/${parts.join('/')}/`);
        }
      } catch {}
    });
  }

  return [...urls];
}

export function discoverHomes(html: string, url: string) {
  const $ = load(html);
  
  // Extract development name
  let name = '';
  const title = $('title').text().trim();
  if (title) {
    const parts = title.split(/ - | \| /);
    for (let i = parts.length - 1; i >= 0; i--) {
      const candidate = parts[i]?.replace(/^[-–—\s]+|[-–—\s]+$/g, '').trim() || '';
      if (candidate && !/harron homes|new build/i.test(candidate)) {
        name = candidate;
        break;
      }
    }
  }
  if (!name) {
    const h1 = $('h1').first().text().trim();
    if (h1 && !/contribution|deposit|discount|save|offer|harron/i.test(h1)) {
      name = h1;
    }
  }
  if (!name) {
    // Derive from URL pathname
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
    name = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // Extract coordinates if present
  let latitude: number | undefined;
  let longitude: number | undefined;
  const marker = $('[data-lat]').first();
  if (marker.length) {
    const lat = Number(marker.attr('data-lat'));
    const lng = Number(marker.attr('data-lng') || marker.attr('data-lon') || marker.attr('data-longitude'));
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= 49 && lat <= 61.2 && lng >= -9 && lng <= 3) {
      latitude = lat;
      longitude = lng;
    }
  }

  const homes: PropertyCandidate[] = [];
  const seen = new Set<string>();

  $('.plot__card').each((_, el) => {
    const card = $(el);
    const link = card.find('a[href*="/find-a-home/"]').first();
    const href = link.attr('href');
    if (!href) return;

    let targetUrl: string;
    try {
      targetUrl = new URL(href, url).href;
    } catch {
      return;
    }

    if (seen.has(targetUrl)) return;
    seen.add(targetUrl);

    const cardText = card.text().replace(/\s+/g, ' ').trim();
    const rawH3 = card.find('h3').first().text().replace(/\s+/g, ' ').trim();
    const plotMatch = cardText.match(/Plot\s+(\d+)/i) || rawH3.match(/Plot\s+(\d+)/i);
    const plotNumber = plotMatch ? plotMatch[1] : undefined;

    let houseName = rawH3.replace(/^Plot\s*\d+\s*/i, '').trim();
    if (!houseName) {
      houseName = 'Home';
    }

    const fullTitle = plotNumber ? `${houseName} · Plot ${plotNumber}` : houseName;

    const bedsMatch = cardText.match(/(\d+)\s*Bedroom/i);
    const bedrooms = bedsMatch ? Number(bedsMatch[1]) : null;

    const priceMatch = cardText.match(/£\s*([\d,]+)/);
    const price = priceMatch ? Number(priceMatch[1]!.replace(/,/g, '')) : null;

    const isDetached = /semi/i.test(cardText) ? false : /detached/i.test(cardText) ? true : null;
    const available = !/sold/i.test(cardText);

    homes.push({
      externalId: new URL(targetUrl).pathname,
      houseTypeExternalId: houseName.toLowerCase().replace(/\W+/g, '-'),
      name: fullTitle,
      url: targetUrl,
      plotNumber,
      bedrooms,
      price,
      propertyType: /apartment|flat/i.test(cardText) ? 'apartment' : 'house',
      isDetached,
      available,
      status: available ? 'available' : 'sold'
    });
  });

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

export function galleryImages(html: string, url?: string): GalleryImageCandidate[] {
  const $ = load(html);
  const images: GalleryImageCandidate[] = [];
  const seen = new Set<string>();

  const excludePattern = /(logo|icon|marker|w3w|ratings|graphic|plan|floor|reveal|placeholder|\.svg)/i;

  const containers = $('.gallery-slider, .gallery-image, .render-image, .plot__hero');
  const targetElements = containers.length > 0 ? containers.find('img') : $('img');

  targetElements.each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
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

  return images;
}
