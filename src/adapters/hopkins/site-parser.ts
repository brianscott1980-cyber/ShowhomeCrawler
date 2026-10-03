import { load } from 'cheerio';
import type { PropertyCandidate, GalleryImageCandidate } from '../../models/domain.js';

const origin = 'https://www.hopkinshomes.co.uk';

function normalizeMediaUrl(url: string): string {
  try {
    const parsed = new URL(url, origin);
    parsed.search = '';
    return parsed.href;
  } catch {
    return url;
  }
}

export function developmentUrls(content: string): string[] {
  const isXml = content.includes('<?xml') || content.includes('<urlset') || content.includes('<sitemap');
  const $ = load(content, isXml ? { xmlMode: true } : {});
  const urls = new Set<string>();

  if (isXml) {
    $('url > loc').each((_, el) => {
      const text = $(el).text().trim();
      try {
        const u = new URL(text);
        if (u.origin !== origin) return;
        if (!u.pathname.startsWith('/developments/')) return;
        if (u.pathname === '/developments/' || u.pathname.startsWith('/developments/house-styles')) return;
        const parts = u.pathname.split('/').filter(Boolean);
        if ((parts.length === 2 && parts[1] !== 'house-styles') || parts.length === 4) {
          urls.add(u.href.endsWith('/') ? u.href : `${u.href}/`);
        }
      } catch {}
    });
  } else {
    $('a[href*="/developments/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const u = new URL(href, origin);
        if (u.origin !== origin) return;
        if (!u.pathname.startsWith('/developments/')) return;
        if (u.pathname === '/developments/' || u.pathname.startsWith('/developments/house-styles')) return;
        const parts = u.pathname.split('/').filter(Boolean);
        if ((parts.length === 2 && parts[1] !== 'house-styles') || parts.length === 4) {
          urls.add(u.href.endsWith('/') ? u.href : `${u.href}/`);
        }
      } catch {}
    });
  }

  return [...urls];
}

export async function enrichPage(html: string): Promise<string> {
  const $ = load(html);

  const mapMatch = html.match(/destination=([-\d.]+),([-\d.]+)/);
  let lat = mapMatch ? Number(mapMatch[1]) : undefined;
  let lon = mapMatch ? Number(mapMatch[2]) : undefined;

  const addrText = $('.dev-contact-card__address').first().text().trim() || $('body').text();
  const pcMatch = addrText.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i);
  const postcode = pcMatch ? pcMatch[1]!.trim().toUpperCase() : undefined;

  if (postcode && (!lat || !lon)) {
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        lat = data.result?.latitude;
        lon = data.result?.longitude;
      }
    } catch {}
  }

  if (lat && lon && Number.isFinite(lat) && Number.isFinite(lon)) {
    $('body').append(`<script type="application/ld+json">${JSON.stringify({
      '@type': 'Place',
      address: { '@type': 'PostalAddress', postalCode: postcode },
      geo: { '@type': 'GeoCoordinates', latitude: lat, longitude: lon }
    })}</script>`);
    return $.html();
  }

  return html;
}

export function discoverHomes(html: string, url: string) {
  const $ = load(html);

  let name = $('h1').first().text().trim();
  if (!name) {
    name = $('title').text().split(/[|,–-]/)[0]!.trim();
  }
  if (!name) {
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
    name = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  const plots: PropertyCandidate[] = [];
  const seen = new Set<string>();

  $('.plot-card, .sitemap-plot').each((_, el) => {
    const card = $(el);
    const linkEl = card.find('a[href]').first();
    const href = linkEl.attr('href') || card.closest('a[href]').attr('href');
    if (!href) return;

    let targetUrl: string;
    try {
      targetUrl = new URL(href, url).href;
    } catch {
      return;
    }

    if (seen.has(targetUrl)) return;
    seen.add(targetUrl);

    const cardText = card.text().trim().replace(/\s+/g, ' ');
    const plotMatch = cardText.match(/^(\d+),|plot\s*(\d+)/i) || targetUrl.match(/-(\d+)\/?$/);
    const plotNumber = plotMatch ? (plotMatch[1] || plotMatch[2]) : undefined;

    let houseName = card.find('.plot-card-compact__title, .plot-card-full__title').text().trim();
    if (!houseName) {
      const parts = cardText.split(/£|\bFor Sale\b|\bReserved\b|\bSold\b/i);
      houseName = parts[0]?.replace(/^\d+,\s*/, '').trim() || '';
    }
    if (!houseName) {
      const lastSlug = new URL(targetUrl).pathname.split('/').filter(Boolean).pop() || '';
      houseName = lastSlug.replace(/-\d+$/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    const displayName = plotNumber && !houseName.includes(plotNumber)
      ? `${houseName} (Plot ${plotNumber})`
      : houseName;

    const priceMatch = cardText.match(/£\s*([\d,]+)/);
    const price = priceMatch ? parseInt(priceMatch[1]!.replace(/,/g, ''), 10) : null;

    let bedrooms: number | null = null;
    const bedMatch = cardText.match(/(\d+)\s*(?:bed|bedroom)/i) || cardText.match(/£[\d,]+\s+(\d+)\s+\d+/);
    if (bedMatch) {
      bedrooms = parseInt(bedMatch[1]!, 10);
    }

    const lower = cardText.toLowerCase();
    let isDetached: boolean | null = null;
    if (/semi-detached|end-terrace|mid-terrace|terrace/i.test(lower)) {
      isDetached = false;
    } else if (/detached/i.test(lower)) {
      isDetached = true;
    }

    const available = !/sold/i.test(cardText);
    const status = /sold/i.test(cardText) ? 'sold' : /reserved/i.test(cardText) ? 'reserved' : 'advertised';

    plots.push({
      externalId: new URL(targetUrl).pathname,
      name: displayName,
      url: targetUrl,
      plotNumber,
      bedrooms,
      price,
      propertyType: /apartment/i.test(cardText) ? 'apartment' : 'house',
      isDetached,
      available,
      status,
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

  $('img, a[href], source').each((_, el) => {
    const raw = $(el).attr('href') || $(el).attr('src') || $(el).attr('srcset') || $(el).attr('data-src') || '';
    if (!raw.includes('/media/')) return;

    const candidates = raw.split(',').map(s => s.trim().split(/\s+/)[0]!);
    for (const cand of candidates) {
      if (!cand.includes('/media/')) continue;
      if (!/\.(jpe?g|png|webp)/i.test(cand)) continue;
      if (/logo|icon|favicon|avatar|mode=crop|afc|nhqc|trustpilot|reciteme/i.test(cand)) continue;

      try {
        const fullUrl = normalizeMediaUrl(new URL(cand, origin).href);
        if (!seen.has(fullUrl)) {
          seen.add(fullUrl);
          images.push({
            url: fullUrl,
            position: images.length,
            altText: $(el).attr('alt') || $(el).attr('title') || undefined,
          });
        }
      } catch {}
    }
  });

  return images;
}
