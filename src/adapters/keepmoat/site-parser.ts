import { load } from 'cheerio';
import type { PropertyCandidate, GalleryImageCandidate } from '../../models/domain.js';

const origin = 'https://www.keepmoat.com';

const nonDevRegex = /\b(policy|policies|terms|careers|privacy|cookie|charitable|pledge|conduct|strategy|plan|notices|hours|complaint|charter|modern-slavery|accessibility|sitemap|search|blog|get-inspired|buying-guide|ways-to-buy|why-keepmoat|contact|corporate|keepsafe|developments|new-build-homes|thanks|ukreiif|housing-20|demo|moneypenny|suppliers|options)\b/i;

const nonDevSlugs = new Set([
  'anti-bribery-corruption',
  'gender-pay-gap',
  'whistleblowing',
  'passwordreset',
  'options-unavailable',
  'options-and-extras',
  'options-and-extras-sales',
  'thanks-for-confirming',
  'ukreiif-2026',
  'moneypenny-dynamics',
  'housing-2025',
  'demo',
  'suppliers-and-subcontractors',
  'keepmoat-community-fund',
  'keepmoat-captures-competition',
  'e-bike-t-c-s',
  'lakeside-ground-floor-screen',
  'north-east',
  'policies-and-notices',
  'our-developments',
  'keepmoat-pension-plan',
  'keepmoat-tax-strategy',
  'new-homes-available'
]);

export function developmentUrls(xml: string): string[] {
  const $ = load(xml, { xmlMode: true });
  const urls = new Set<string>();
  $('url > loc').each((_, el) => {
    const text = $(el).text().trim();
    try {
      const url = new URL(text);
      if (url.origin !== origin) return;
      const parts = url.pathname.split('/').filter(Boolean);
      const slug = parts[0];
      if (!slug || nonDevSlugs.has(slug) || nonDevRegex.test(slug)) return;

      if (parts.length === 1 || parts.length === 2) {
        urls.add(`${origin}/${slug}`);
      }
    } catch {}
  });
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

  const homes: PropertyCandidate[] = [];
  const seen = new Set<string>();

  $('.home-styles a.home-style').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const target = new URL(href, url);
    if (seen.has(target.href)) return;
    seen.add(target.href);

    const text = $(el).text().replace(/\s+/g, ' ').trim();
    const houseName = $(el).find('h3').first().text().trim() || target.pathname.split('/').pop() || 'Home';
    const priceMatch = text.match(/£\s*([\d,]+)/);
    const price = priceMatch ? Number(priceMatch[1]!.replace(/,/g, '')) : null;
    const bedsMatch = text.match(/(\d+)\s*bed/i);
    const bedrooms = bedsMatch ? Number(bedsMatch[1]) : null;
    const isDetached = /semi/i.test(text) ? false : /detached/i.test(text) ? true : null;
    const available = !/sold|none-available/i.test(text);

    homes.push({
      externalId: target.pathname,
      name: houseName,
      url: target.href,
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
    homes,
    plots: homes,
    plotError: null
  };
}

export function galleryImages(html: string): GalleryImageCandidate[] {
  const $ = load(html);
  const images: GalleryImageCandidate[] = [];
  const seen = new Set<string>();

  $('.img-slider a[data-fancybox], .img-slider img, .fb-gallery, a.fb-gallery').each((_, el) => {
    const raw = $(el).attr('href') || $(el).attr('src') || $(el).attr('data-src');
    if (!raw || !raw.includes('/getmedia/')) return;
    if (/ratings|logo|badge|icon|floorplan|map|accreditation/i.test(raw)) return;

    const normalized = raw.replace(/^.*\/getmedia\//, 'https://www.keepmoat.com/getmedia/');
    if (seen.has(normalized)) return;
    seen.add(normalized);

    const alt = $(el).attr('alt') || $(el).find('img').attr('alt') || undefined;
    images.push({
      url: normalized,
      position: images.length,
      altText: alt
    });
  });

  return images;
}
