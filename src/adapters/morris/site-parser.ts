import {cleanHomeName} from '../../reports/home-display.js';
import { load } from 'cheerio';
import type { PropertyCandidate, GalleryImageCandidate } from '../../models/domain.js';

const origin = 'https://www.morrishomes.co.uk';

const nonDevSlugs = new Set([
  'broadacre',
  'lathom-grange',
  'pavilion-row',
  'the-willows',
  'upholland-gardens',
  'davenham'
]);

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
        if (parts.length >= 2 && parts[0] === 'development') {
          const devSlug = parts[1]!;
          if (!nonDevSlugs.has(devSlug)) {
            urls.add(`${origin}/development/${devSlug}/`);
          }
        }
      } catch {}
    });
  } else {
    $('a[href*="/development/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const url = new URL(href, origin);
        if (url.origin !== origin) return;
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length >= 2 && parts[0] === 'development') {
          const devSlug = parts[1]!;
          if (!nonDevSlugs.has(devSlug)) {
            urls.add(`${origin}/development/${devSlug}/`);
          }
        }
      } catch {}
    });
  }

  return [...urls];
}

export function discoverHomes(html: string, url: string) {
  const $ = load(html);
  let name = $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.split('|')[0]?.trim() || '';
  if (!name) {
    const title = $('title').text().split('|')[0]?.trim() || '';
    name = title;
  }
  if (!name) throw new Error('Missing development name');

  let latitude: number | undefined;
  let longitude: number | undefined;
  const locMatch = html.match(/var\s+location\s*=\s*\{\s*lat:\s*(-?\d+\.\d+),\s*lng:\s*(-?\d+\.\d+)\s*\}/);
  if (locMatch) {
    const lat = Number(locMatch[1]), lon = Number(locMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= 49 && lat <= 61.2 && lon >= -9 && lon <= 3) {
      latitude = lat;
      longitude = lon;
    }
  }

  const homes: PropertyCandidate[] = [];
  const seenPlots = new Set<string>();

  // Check embedded var markers array
  const markersMatch = html.match(/var\s+markers\s*=\s*(\[.*?\]);/s);
  if (markersMatch) {
    try {
      const markers = JSON.parse(markersMatch[1]!);
      if (Array.isArray(markers)) {
        for (const m of markers) {
          if (!m || typeof m !== 'object') continue;
          const plotNumber = m.plotNumber != null ? String(m.plotNumber).trim() : undefined;
          const childTitle = (m.childTitle || '').trim();
          const permalink = (m.permalink || '').trim();
          const targetUrl = permalink ? new URL(permalink, url).href : url;
          const identityKey = `${targetUrl}#${plotNumber || childTitle}`;
          if (seenPlots.has(identityKey)) continue;
          seenPlots.add(identityKey);

          const bedrooms = m.bedrooms != null && !isNaN(Number(m.bedrooms)) ? Number(m.bedrooms) : null;
          const priceStr = typeof m.price === 'string' ? m.price : '';
          const priceMatch = priceStr.match(/[\d,]+/);
          const price = priceMatch ? Number(priceMatch[0].replace(/,/g, '')) : null;

          const houseName = childTitle || 'Home';
          const fullTitle = plotNumber ? `${houseName} · Plot ${plotNumber}` : houseName;
          const available = m.status !== 'sold' && m.status !== 'draft';

          homes.push({
            externalId: plotNumber ? `${new URL(targetUrl).pathname}#plot-${plotNumber}` : new URL(targetUrl).pathname,
            houseTypeExternalId: houseName.toLowerCase().replace(/\W+/g, '-'),
            name: cleanHomeName(fullTitle),
            url: targetUrl,
            plotNumber,
            bedrooms,
            price,
            propertyType: /apartment|flat/i.test(houseName) ? 'apartment' : 'house',
            isDetached: /semi/i.test(houseName) ? false : /detached/i.test(houseName) ? true : null,
            available,
            status: available ? 'available' : 'reserved'
          });
        }
      }
    } catch {}
  }

  // Also check for house card links if markers was empty or missing
  if (homes.length === 0) {
    $('a[href*="/development/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const u = new URL(href, url);
        if (u.origin !== origin) return;
        const currentPath = new URL(url).pathname.replace(/\/$/, '');
        const targetPath = u.pathname.replace(/\/$/, '');
        if (targetPath.startsWith(currentPath) && targetPath !== currentPath) {
          const parts = targetPath.slice(currentPath.length + 1).split('/');
          if (parts.length === 1 && !seenPlots.has(u.href)) {
            seenPlots.add(u.href);
            const houseName = $(el).text().trim() || parts[0]!.replace(/-/g, ' ');
            if (houseName && !/view|explore|read|more/i.test(houseName)) {
              homes.push({
                externalId: u.pathname,
                houseTypeExternalId: parts[0]!.toLowerCase(),
                name: cleanHomeName(houseName),
                url: u.href,
                bedrooms: null,
                price: null,
                propertyType: 'house',
                isDetached: null,
                available: true,
                status: 'available'
              });
            }
          }
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

export function galleryImages(html: string, url?: string): GalleryImageCandidate[] {
  const $ = load(html);
  const images: GalleryImageCandidate[] = [];
  const seen = new Set<string>();

  const excludePattern = /(logo|icon|marker|warranty|ratings|deposit|great-start|\.png)/i;

  const containers = $('.single__property-header, .slider--fullwidth, .region-slider, .full-image-carousel-block, .single__property-boxes');
  const targetElements = containers.length > 0 ? containers.find('img') : $('img');

  targetElements.each((_, el) => {
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

  return images;
}
