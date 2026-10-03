import { load } from 'cheerio';
import type { PropertyCandidate, GalleryImageCandidate } from '../../models/domain.js';

const origin = 'https://allison-homes.co.uk';

function normalizeImageUrl(url: string): string {
  try {
    const parsed = new URL(url, origin);
    parsed.search = '';
    // Strip WordPress thumbnail dimensions like -768x522, -1024x683
    parsed.pathname = parsed.pathname.replace(/-\d+x\d+(\.[a-zA-Z]+)$/, '$1');
    return parsed.href;
  } catch {
    return url;
  }
}

export function developmentUrls(sitemapXml: string): string[] {
  const $ = load(sitemapXml, { xmlMode: true });
  const urls = new Set<string>();

  $('loc').each((_, el) => {
    const raw = $(el).text().trim();
    if (!raw) return;
    try {
      const parsed = new URL(raw, origin);
      // Developments follow /development/<slug>/
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts[0] === 'development' && parts.length === 2) {
        urls.add(parsed.href);
      }
    } catch {}
  });

  return [...urls];
}

export async function enrichPage(html: string, fetchText?: (url: string) => Promise<string>): Promise<string> {
  const $ = load(html);

  // Extract embedded lat/lng
  const latMatch = html.match(/lat\s*=\s*parseFloat\(["']([^"']+)["']\)/i);
  const lngMatch = html.match(/lng\s*=\s*parseFloat\(["']([^"']+)["']\)/i);
  const lat = latMatch ? parseFloat(latMatch[1]!) : NaN;
  const lon = lngMatch ? parseFloat(lngMatch[1]!) : NaN;

  let address = $('.development_address a, .development_address').first().text().trim();
  const postcodeMatch = address.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i) || html.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i);
  const postcode = postcodeMatch ? postcodeMatch[1]!.trim().toUpperCase() : undefined;

  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    $('body').append(`<script type="application/ld+json">${JSON.stringify({
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        streetAddress: address || undefined,
        postalCode: postcode || undefined,
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: lat,
        longitude: lon,
      }
    })}</script>`);
  } else if (postcode) {
    try {
      const fetchFn = fetchText || (async (u: string) => (await fetch(u, { signal: AbortSignal.timeout(5000) })).text());
      const res = await fetchFn(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
      const data = JSON.parse(res);
      const pLat = data.result?.latitude;
      const pLon = data.result?.longitude;
      if (Number.isFinite(pLat) && Number.isFinite(pLon)) {
        $('body').append(`<script type="application/ld+json">${JSON.stringify({
          '@type': 'Place',
          address: { '@type': 'PostalAddress', streetAddress: address, postalCode: postcode },
          geo: { '@type': 'GeoCoordinates', latitude: pLat, longitude: pLon }
        })}</script>`);
      }
    } catch {}
  }

  return $.html();
}

export function discoverHomes(html: string, url: string) {
  const $ = load(html);

  let name = $('meta[property="og:title"]').attr('content') || '';
  if (!name || name.toLowerCase().includes('living in')) {
    name = $('h1').first().text().trim();
  }
  if (!name || name.toLowerCase().includes('living in')) {
    const titleParts = $('title').text().split('|').map(s => s.trim()).filter(Boolean);
    for (const part of titleParts) {
      if (!/new homes|homes for sale|allison homes/i.test(part)) {
        name = part;
        break;
      }
    }
  }
  name = name.replace(/^(New Homes in|Homes for Sale in)\s+[^|]+\|\s*/i, '').trim();
  name = name.replace(/\s*\|\s*Allison Homes.*$/i, '').trim();
  if (!name || name.toLowerCase().includes('living in')) {
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
    name = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  const plots: PropertyCandidate[] = [];
  const seen = new Set<string>();

  // 1. Check table rows (tbody tr)
  $('tbody tr').each((_, el) => {
    const $row = $(el);
    const linkEl = $row.find('a[href*="/property-"], a[href*="/plot/"], a').first();
    const href = linkEl.attr('href');
    if (!href) return;

    let targetUrl: string;
    try {
      targetUrl = new URL(href, origin).href;
    } catch {
      return;
    }

    if (seen.has(targetUrl)) return;

    const rowText = $row.text().replace(/\s+/g, ' ').trim();
    const plotNo = $row.find('.plot-no').text().trim() || rowText.match(/\b(\d+)\b/)?.[1] || '';
    const plotTitle = plotNo ? `Plot ${plotNo}` : linkEl.text().trim() || 'Plot';

    const bedsMatch = rowText.match(/(\d+)\s*(?:bed|bedroom)/i) || $row.find('td').eq(2).text().match(/(\d+)/);
    const bedrooms = bedsMatch ? parseInt(bedsMatch[1]!, 10) : null;

    const priceMatch = rowText.match(/£([\d,]+)/);
    const price = priceMatch ? parseInt(priceMatch[1]!.replace(/,/g, ''), 10) : null;

    let propertyType: string | null = null;
    let isDetached: boolean | null = null;
    const lower = rowText.toLowerCase();
    if (lower.includes('semi detached') || lower.includes('semi-detached')) {
      propertyType = 'semi-detached';
      isDetached = false;
    } else if (lower.includes('detached')) {
      propertyType = 'detached';
      isDetached = true;
    } else if (lower.includes('terrace') || lower.includes('townhouse')) {
      propertyType = 'terraced';
      isDetached = false;
    } else if (lower.includes('apartment') || lower.includes('flat')) {
      propertyType = 'apartment';
      isDetached = false;
    }

    seen.add(targetUrl);
    plots.push({
      externalId: new URL(targetUrl).pathname,
      name: plotTitle,
      url: targetUrl,
      bedrooms,
      price,
      propertyType,
      isDetached,
      available: true,
      status: 'advertised',
    });
  });

  // 2. Check embedded var all_plots = [...] if no table rows found
  if (plots.length === 0) {
    const plotsMatch = html.match(/var\s+all_plots\s*=\s*(\[[\s\S]*?\]);/);
    if (plotsMatch) {
      try {
        const rawPlots = JSON.parse(plotsMatch[1]!);
        for (const p of rawPlots) {
          const plotUrl = `${url}#plot-${p.id}`;
          if (seen.has(plotUrl)) continue;
          seen.add(plotUrl);

          const beds = p.bedrooms ? parseInt(String(p.bedrooms), 10) : null;
          const price = typeof p.price === 'number' ? p.price : null;
          const pTypeRaw = String(p.property_type || '').toLowerCase();
          let propertyType: string | null = null;
          let isDetached: boolean | null = null;
          if (pTypeRaw.includes('semi')) {
            propertyType = 'semi-detached';
            isDetached = false;
          } else if (pTypeRaw.includes('detached')) {
            propertyType = 'detached';
            isDetached = true;
          } else if (pTypeRaw.includes('terrace')) {
            propertyType = 'terraced';
            isDetached = false;
          } else if (pTypeRaw.includes('apartment')) {
            propertyType = 'apartment';
            isDetached = false;
          }

          plots.push({
            externalId: `${new URL(url).pathname}#plot-${p.id}`,
            name: `Plot ${p.id}`,
            url: plotUrl,
            bedrooms: Number.isFinite(beds) ? beds : null,
            price,
            propertyType,
            isDetached,
            available: true,
            status: 'advertised',
          });
        }
      } catch {}
    }
  }

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

  $('img, a[href], div[data-image], div[style*="background-image"]').each((_, el) => {
    let raw = $(el).attr('src') || $(el).attr('href') || $(el).attr('data-src') || $(el).attr('data-image') || '';
    if (!raw && $(el).attr('style')) {
      const match = $(el).attr('style')!.match(/url\(["']?([^"')]+)["']?\)/);
      if (match) raw = match[1]!;
    }
    if (!raw) return;
    if (!raw.includes('/wp-content/uploads/')) return;
    if (!/\.(jpe?g|png|webp)/i.test(raw)) return;
    if (/logo|icon|avatar|favicon|arrow|marker|badge|map|trustpilot/i.test(raw)) return;

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
