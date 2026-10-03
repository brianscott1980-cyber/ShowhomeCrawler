import { load } from 'cheerio';
import type { PropertyCandidate, GalleryImageCandidate } from '../../models/domain.js';

const origin = 'https://www.wainhomes.co.uk';

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
        // /find-your-home/<region>/<area>/<development>/
        if (parts.length === 4 && parts[0] === 'find-your-home') {
          urls.add(url.href.endsWith('/') ? url.href : `${url.href}/`);
        }
      } catch {}
    });
  } else {
    $('a[href*="/find-your-home/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const url = new URL(href, origin);
        if (url.origin !== origin) return;
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length === 4 && parts[0] === 'find-your-home') {
          urls.add(url.href.endsWith('/') ? url.href : `${url.href}/`);
        }
      } catch {}
    });
  }

  return [...urls];
}

export async function enrichPage(html: string): Promise<string> {
  const $ = load(html);
  const address = $('.development-plot-header__address, .development-plot-header__address-container').first().text().trim();
  const postcodeMatch = address.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i) || html.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i);
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
          return $.html();
        }
      }
    } catch {}
  }
  return html;
}

export function discoverHomes(html: string, url: string) {
  const $ = load(html);

  // Extract development name
  let name = $('h1').first().text().trim();
  if (!name) {
    const title = $('title').text().trim();
    if (title) {
      name = title.split(/[|,–-]/)[0]!.trim();
    }
  }
  if (!name) {
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
    name = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  const plots: PropertyCandidate[] = [];
  const seen = new Set<string>();

  $('.development-homes-card').each((_, el) => {
    const card = $(el);
    const link = card.find('.development-homes-card__image-container a, .development-homes-card__title-container a').first().attr('href');
    if (!link) return;

    let targetUrl: string;
    try {
      targetUrl = new URL(link, url).href;
    } catch {
      return;
    }

    if (seen.has(targetUrl)) return;
    seen.add(targetUrl);

    const plotTitle = card.find('.development-homes-card__title').text().trim();
    const houseType = card.find('.development-homes-card__location-housetype').text().trim();
    const displayName = houseType && plotTitle ? `${houseType} (${plotTitle})` : houseType || plotTitle || 'Home';
    const plotNumber = plotTitle.match(/\d+/)?.[0];

    const details = card.find('.development-homes-card__detail').map((_, d) => $(d).text().trim()).get();
    let bedrooms: number | null = null;
    let isDetached: boolean | null = null;
    let propertyType = 'house';

    for (const d of details) {
      const lower = d.toLowerCase();
      if (/semi-detached/i.test(lower)) {
        isDetached = false;
      } else if (/detached/i.test(lower)) {
        isDetached = true;
      } else if (/terraced/i.test(lower)) {
        isDetached = false;
      } else if (/bungalow/i.test(lower)) {
        propertyType = 'bungalow';
      }

      const bedMatch = d.match(/^(\d+)$/) || d.match(/(\d+)\s*bed/i);
      if (bedMatch && bedrooms === null) {
        const b = parseInt(bedMatch[1]!, 10);
        if (Number.isInteger(b) && b > 0 && b <= 10) {
          bedrooms = b;
        }
      }
    }

    const priceText = card.find('.development-homes-card__price').text().trim();
    const priceMatch = priceText.match(/£\s*([\d,]+)/);
    const price = priceMatch ? parseInt(priceMatch[1]!.replace(/,/g, ''), 10) : null;

    plots.push({
      externalId: new URL(targetUrl).pathname,
      name: displayName,
      url: targetUrl,
      plotNumber,
      bedrooms,
      price,
      propertyType,
      isDetached,
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

function normalizeImageUrl(rawUrl: string): string {
  return rawUrl.split('?')[0]!.replace(/-\d+x\d+(?=\.(?:jpe?g|png|webp)$)/i, '');
}

export function galleryImages(html: string): GalleryImageCandidate[] {
  const $ = load(html);
  const images: GalleryImageCandidate[] = [];
  const seen = new Set<string>();

  // 1. Full-size images from anchor links
  $('a[href]').each((_, el) => {
    const rawHref = $(el).attr('href')?.split('?')[0];
    if (!rawHref) return;
    if (/\.(jpe?g|png|webp)$/i.test(rawHref) && rawHref.includes('/wp-content/uploads/')) {
      if (/logo|icon|trustpilot|nhos|nhqb|badge|rating/i.test(rawHref)) return;
      try {
        const u = normalizeImageUrl(new URL(rawHref, origin).href);
        if (!seen.has(u)) {
          seen.add(u);
          images.push({
            url: u,
            position: images.length,
            altText: $(el).find('img').attr('alt') || $(el).attr('title') || undefined,
          });
        }
      } catch {}
    }
  });

  // 2. Images from img tags (excluding thumbnails inside already handled links)
  $('img').each((_, el) => {
    const img = $(el);
    if (img.closest('a[href$=".jpg"], a[href$=".jpeg"], a[href$=".png"], a[href$=".webp"]').length) {
      return;
    }

    let src = img.attr('src') || '';
    const srcset = img.attr('srcset') || '';
    if (srcset) {
      const parts = srcset.split(',').map(s => s.trim().split(/\s+/)).filter(p => p[0]);
      parts.sort((a, b) => {
        const wa = parseInt(a[1] || '0', 10);
        const wb = parseInt(b[1] || '0', 10);
        return wb - wa;
      });
      if (parts[0]?.[0]) {
        src = parts[0][0];
      }
    }
    src = src.split('?')[0] || '';
    if (!src || !/\.(jpe?g|png|webp)$/i.test(src) || !src.includes('/wp-content/uploads/')) return;
    if (/logo|icon|trustpilot|nhos|nhqb|badge|rating/i.test(src)) return;
    try {
      const u = normalizeImageUrl(new URL(src, origin).href);
      if (!seen.has(u)) {
        seen.add(u);
        images.push({
          url: u,
          position: images.length,
          altText: img.attr('alt') || undefined,
        });
      }
    } catch {}
  });

  return images;
}
