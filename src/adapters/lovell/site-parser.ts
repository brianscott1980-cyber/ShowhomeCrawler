import { load } from 'cheerio';
import type { PropertyCandidate, GalleryImageCandidate } from '../../models/domain.js';

const origin = 'https://newhomes.lovell.co.uk';

export function developmentUrls(xml: string): string[] {
  const $ = load(xml, { xml: true });
  return [...new Set($('url > loc').map((_, element) => $(element).text().trim()).get().filter(value => {
    const url = new URL(value);
    return url.origin === origin && /^\/development\/[^/]+\/$/.test(url.pathname);
  }))];
}

export async function enrichPage(html: string): Promise<string> {
  const $ = load(html);
  $('[data-development-json]').each((_, element) => {
    const data = JSON.parse($(element).attr('data-development-json')!);
    const address = data.address;
    const lat = Number(address?.coordinates?.lat), lon = Number(address?.coordinates?.lng);
    if (lat >= 49 && lat <= 61.2 && lon >= -9 && lon <= 3) {
      $('body').append(`<script type="application/ld+json">${JSON.stringify({
        '@type': 'Place', geo: { latitude: lat, longitude: lon },
        address: { '@type': 'PostalAddress', postalCode: address.postalcode, addressRegion: address.state, addressCountry: address.country },
      }).replaceAll('<', '\\u003c')}</script>`);
    }
  });
  return $.html();
}

export function discoverHomes(html: string, url: string) {
  const $ = load(html);
  const heading = $('h1').first().clone();
  heading.children().remove();
  const name = heading.text().trim();
  if (!name) throw new Error('Missing development name');
  const homes = new Map<string, PropertyCandidate>();
  $('.card a[data-house-type]').each((_, element) => {
    const link = $(element), raw = link.attr('href');
    if (!raw) return;
    const target = new URL(raw, origin);
    if (target.origin !== origin || !target.pathname.startsWith(new URL(url).pathname) || target.pathname.slice(new URL(url).pathname.length).split('/').filter(Boolean).length !== 1) {
      throw new Error('Unexpected house type URL');
    }
    if (homes.has(target.href)) return;
    const text = link.closest('.card').text().replace(/\s+/g, ' ');
    homes.set(target.href, {
      externalId: target.pathname, name: link.attr('data-house-type')!, url: target.href,
      bedrooms: Number(text.match(/(\d+)\s*bedroom/i)?.[1]) || null,
      price: Number(text.match(/£\s*([\d,]+)/)?.[1]?.replaceAll(',', '')) || null,
      propertyType: 'house', isDetached: null, available: !/sold out/i.test(text), status: 'advertised',
    });
  });
  const plots = [...homes.values()];
  const gallery: PropertyCandidate = {
    externalId: new URL(url).pathname, name: `${name} development gallery`, url,
    bedrooms: null, price: null, propertyType: 'development', isDetached: null,
    available: true, status: 'published gallery',
  };
  return { development: { name, url }, homes: [...plots, gallery], plots, plotError: null };
}

export function galleryImages(html: string): GalleryImageCandidate[] {
  const $ = load(html), images: GalleryImageCandidate[] = [], seen = new Set<string>();
  // Property banners and floorplan panels; unrelated news and promotional cards are outside these sections.
  $('.dev-carousel img, .card-deck-slider img.img-fluid').each((_, element) => {
    const image = $(element);
    const raw = image.attr('data-srcset') || image.attr('src') || image.closest('picture').find('source').first().attr('srcset');
    if (!raw) return;
    const url = new URL(raw.split(',')[0]!.trim().split(/\s+/)[0]!, origin);
    if (url.origin === origin && url.pathname === '/images/development/trustpilot-review.svg') return;
    if (url.origin !== origin || !url.pathname.startsWith('/media/')) throw new Error('Unexpected gallery image origin');
    // Keep the entire source image instead of a cropped responsive variant.
    url.search = '?rmode=max&width=2048';
    if (seen.has(url.href)) return;
    seen.add(url.href);
    images.push({ url: url.href, position: images.length, altText: image.attr('alt') });
  });
  return images;
}
