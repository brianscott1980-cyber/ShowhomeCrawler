import { load } from 'cheerio';
import type { PropertyCandidate, GalleryImageCandidate } from '../../models/domain.js';

const origin = 'https://bloorhomes.com';

export function developmentUrls(xml: string): string[] {
  const $ = load(xml, { xmlMode: true });
  const urls = new Set<string>();
  $('url > loc').each((_, el) => {
    const text = $(el).text().trim();
    try {
      const url = new URL(text);
      if (url.origin === origin && /^\/new-homes\/[^/]+\/[^/]+\/[^/]+\/?$/.test(url.pathname)) {
        urls.add(url.href.replace(/\/$/, ''));
      }
    } catch {}
  });
  return [...urls];
}

export function discoverHomes(html: string, url: string) {
  const $ = load(html);
  let name = '';
  const dlMatch = html.match(/window\.dataLayer\.push\(([\s\S]*?)\);/);
  if (dlMatch) {
    try {
      const data = JSON.parse(dlMatch[1]!);
      if (data.development) name = data.development.trim();
    } catch {}
  }
  if (!name) name = $('h2').first().text().trim() || $('h1').first().text().trim();
  if (!name) throw new Error('Missing development name');

  const plots: PropertyCandidate[] = [];
  const seen = new Set<string>();
  $('a[href*="/plot-"]').each((_, e) => {
    const href = $(e).attr('href');
    if (!href) return;
    const target = new URL(href, url);
    if (seen.has(target.href)) return;
    seen.add(target.href);

    const card = $(e).closest('article, div[class*="HomeCard"], div[class*="card"], li');
    const text = card.length ? card.text().trim().replace(/\s+/g, ' ') : $(e).text().trim().replace(/\s+/g, ' ');
    const plotMatch = target.pathname.match(/\/plot-(\d+)/i) || text.match(/plot\s*(\d+)/i);
    const plotNumber = plotMatch ? plotMatch[1] : undefined;
    const bedMatch = text.match(/(\d+)\s*bed/i);
    const bedrooms = bedMatch ? Number(bedMatch[1]) : null;
    const priceMatch = text.match(/£\s*([\d,]+)/);
    const price = priceMatch ? Number(priceMatch[1]!.replace(/,/g, '')) : null;
    const houseMatch = text.match(/(The\s+[A-Za-z]+)/);
    const houseName = houseMatch ? houseMatch[1] : 'Plot ' + (plotNumber || '');
    const available = /available/i.test(text) && !/sold|reserved/i.test(text);
    const isDetached = /semi/i.test(text) ? false : /detached/i.test(text) ? true : null;

    plots.push({
      externalId: target.pathname,
      name: `${houseName} · Plot ${plotNumber || ''}`,
      url: target.href,
      plotNumber,
      bedrooms,
      price,
      propertyType: /apartment|flat/i.test(text) ? 'apartment' : 'house',
      isDetached,
      available,
      status: available ? 'available' : 'reserved'
    });
  });

  return {
    development: { name, url },
    homes: plots,
    plots,
    plotError: null
  };
}

export function galleryImages(html: string): GalleryImageCandidate[] {
  const $ = load(html);
  const images: GalleryImageCandidate[] = [];
  const seen = new Set<string>();
  $('img').each((_, e) => {
    const src = $(e).attr('src') || $(e).attr('data-src');
    if (!src || !src.includes('res.cloudinary.com/bloor-homes-production/image/upload/')) return;
    if (/icon|logo|nhqc|nhos|ratings|badge|car-dark|car-light|house-icon|bed-dark|lightbulb-dark/i.test(src) || /icon/i.test($(e).attr('alt') || '')) return;
    const normalized = src.replace(/\/upload\/[^/]+(?=\/f_auto|\/v1|\/[a-zA-Z0-9_-]+$)/, '/upload/c_limit,w_1600');
    if (seen.has(normalized)) return;
    seen.add(normalized);
    images.push({
      url: normalized,
      position: images.length,
      altText: $(e).attr('alt') || undefined
    });
  });
  return images;
}
