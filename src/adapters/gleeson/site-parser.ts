import { load } from 'cheerio';
import type { PropertyCandidate, GalleryImageCandidate } from '../../models/domain.js';

const origin = 'https://gleesonhomes.co.uk';

const regionSlugs = new Set([
  'barnsley',
  'bishop-auckland',
  'boston',
  'bradford',
  'carlisle',
  'chesterfield',
  'county-durham',
  'cumbria',
  'derbyshire',
  'doncaster',
  'durham',
  'east-yorkshire',
  'gainsborough',
  'lancashire',
  'lincolnshire',
  'mansfield',
  'nottinghamshire',
  'north-yorkshire',
  'sheffield',
  'south-yorkshire',
  'tees-valley',
  'tyne-and-wear',
  'wakefield',
  'west-yorkshire',
  'yorkshire'
]);

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
        if (parts.length === 2 && parts[0] === 'developments') {
          const slug = parts[1]!;
          if (!regionSlugs.has(slug)) {
            urls.add(`${origin}/developments/${slug}/`);
          }
        }
      } catch {}
    });
  } else {
    $('a[href*="/developments/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const url = new URL(href, origin);
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length === 2 && parts[0] === 'developments') {
          const slug = parts[1]!;
          if (!regionSlugs.has(slug)) {
            urls.add(`${origin}/developments/${slug}/`);
          }
        }
      } catch {}
    });
  }

  return [...urls];
}

export function discoverHomes(html: string, url: string) {
  const $ = load(html);
  let name = $('h1').first().text().trim() || $('meta[property="og:title"]').attr('content')?.split('|')[0]?.trim() || '';
  if (!name) {
    const title = $('title').text().split('|')[0]?.trim() || '';
    name = title;
  }
  if (!name) throw new Error('Missing development name');

  const plots: PropertyCandidate[] = [];
  const seen = new Set<string>();

  $('.result-card').each((_, el) => {
    const link = $(el).find('a[href*="/developments/"]').first();
    const href = link.attr('href')?.trim();
    if (!href) return;
    const target = new URL(href, url);
    if (seen.has(target.href)) return;
    seen.add(target.href);

    const heading = $(el).find('h3').first().text().replace(/\s+/g, ' ').trim();
    const specText = $(el).find('.result-card__spec').text().replace(/\s+/g, ' ').trim();
    const priceText = $(el).find('strong').text().replace(/\s+/g, ' ').trim();

    const plotMatch = heading.match(/plot\s*(\d+)/i) || target.pathname.match(/\/(\d+)\/?$/);
    const plotNumber = plotMatch ? plotMatch[1] : undefined;
    const houseMatch = heading.match(/[–-]\s*([A-Za-z]+)/);
    const houseName = houseMatch ? houseMatch[1] : 'Plot ' + (plotNumber || '');
    const bedMatch = specText.match(/(\d+)\s*bed/i);
    const bedrooms = bedMatch ? Number(bedMatch[1]) : null;
    const priceMatch = priceText.match(/£\s*([\d,]+)/);
    const price = priceMatch ? Number(priceMatch[1]!.replace(/,/g, '')) : null;
    const isDetached = /semi/i.test(specText) ? false : /detached/i.test(specText) ? true : null;

    plots.push({
      externalId: target.pathname,
      name: `${houseName} · Plot ${plotNumber || ''}`,
      url: target.href,
      plotNumber,
      bedrooms,
      price,
      propertyType: /apartment|flat/i.test(specText) ? 'apartment' : 'house',
      isDetached,
      available: true,
      status: 'available'
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

  $('.media-carousel__carousel-item picture, .media-carousel__carousel-item, figure.feature-image').each((_, container) => {
    const sources = $(container).find('source').toArray().map(s => $(s).attr('srcset')).filter((s): s is string => Boolean(s));
    const bestSource = sources.find(s => s.includes('1200x800')) ||
      sources.find(s => s.includes('900x600')) ||
      sources.find(s => s.includes('1600x1600')) ||
      sources[0] ||
      $(container).find('img').attr('src');

    if (!bestSource || !bestSource.includes('/site/assets/files/')) return;
    if (/logo|badge|icon|footer|nhqc/i.test(bestSource)) return;

    const fullUrl = new URL(bestSource, origin).href;
    if (seen.has(fullUrl)) return;
    seen.add(fullUrl);

    const alt = $(container).find('img').attr('alt') || undefined;
    images.push({
      url: fullUrl,
      position: images.length,
      altText: alt
    });
  });

  return images;
}
