import { load } from 'cheerio';
import type { PropertyCandidate, GalleryImageCandidate } from '../../models/domain.js';
export function createSiteParser(origin: string) {
function developmentUrls(xml: string): string[] {
 const $ = load(xml, { xmlMode: true }); const urls = new Set<string>();
 $('url > loc').each((_, el) => { const url = new URL($(el).text().trim()); if (url.origin === origin && /^\/new-homes\/dev-?\d+-[^/]+\/$/.test(url.pathname)) urls.add(url.href); });
 return [...urls];
}
function discoverHomes(html: string, url: string) {
 const $ = load(html); const name = $('h1').first().text().trim();
 if (!name || !$('[data-page-type="development"], .plot-list').length) throw new Error('Unexpected development page.');
 let unlinkedPlots = 0;
 const plots: PropertyCandidate[] = []; const seen = new Set<string>();
 $('.plot-list__plot a.plot').each((_, el) => {
  const card = $(el); const href = card.attr('href'); if (!href) return;
  const linked = new URL(href, url); if (linked.href === origin || linked.href === origin + '/') { unlinkedPlots++; return; } if (linked.origin !== origin || !linked.pathname.startsWith(new URL(url).pathname) || !/\/plot-[^/]+\/$/.test(linked.pathname)) throw new Error('Unexpected plot URL.');
  if (seen.has(linked.href)) return; seen.add(linked.href);
  const text = card.find('.plot__features').text(); const beds = text.match(/(\d+)\s*bed/i); const price = text.match(/£\s*([\d,]+)/);
  const house = card.find('.plot__sales-name').text().trim(); const reserved = /reserved|sold/i.test(card.find('.plot__status-container').text());
  plots.push({ externalId: 'plot:' + linked.pathname, houseTypeExternalId: house.toLowerCase().replace(/\W+/g, '-'), name: house || card.find('h3').text().trim(), url: linked.href, plotNumber: card.find('h3').text().match(/Plot\s+(\S+)/i)?.[1], bedrooms: beds ? Number(beds[1]) : null, price: price ? Number(price[1]!.replaceAll(',', '')) : null, propertyType: 'house', isDetached: null, available: !reserved, status: reserved ? 'reserved' : 'available' });
 });
 return { development: { name, url }, plots, homes: plots, plotError: unlinkedPlots ? `${unlinkedPlots} plot cards have no details link; galleries unavailable.` : null };
}
function galleryImages(html: string): GalleryImageCandidate[] {
 const $ = load(html); const images = new Map<string, GalleryImageCandidate>();
 $('.marketing-header--plot .carousel img').each((_, el) => {
  const raw = ($(el).attr('data-src')?.split('|').at(-1) ?? $(el).attr('src'))?.trim(); if (!raw) return;
  const url = new URL(raw, origin); if (url.origin !== origin || !url.pathname.startsWith('/-/media/')) throw new Error('Unexpected gallery host.');
  const key = url.origin + url.pathname; if (!images.has(key)) images.set(key, { url: url.href, position: images.size, altText: $(el).attr('alt') });
 });
 return [...images.values()];
}

 return { developmentUrls, discoverHomes, galleryImages };
}
export const { developmentUrls, discoverHomes, galleryImages } = createSiteParser('https://www.barratthomes.co.uk');
