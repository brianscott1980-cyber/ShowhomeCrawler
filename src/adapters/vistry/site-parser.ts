import { load } from 'cheerio';
import type { PropertyCandidate, GalleryImageCandidate } from '../../models/domain.js';
export function createVistryParser(origin: string) {
 const safeUrl = (value: string) => { const url = new URL(value, origin); if (url.origin !== origin) throw new Error('Unexpected Vistry source origin'); return url; };
 return {
  developmentUrls(xml: string) { const $ = load(xml, { xml: true }); return [...new Set($('url > loc').map((_, e) => $(e).text().trim()).get().filter(value => { const url = new URL(value); return url.origin === origin && /^\/developments\/[^/]+\/[^/]+\/?$/.test(url.pathname); }))]; },
  async enrichPage(html: string, fetchText: (url: string) => Promise<string>) {
   const endpoint = html.match(/fetch\(['"](\/ajax\/get-available-plots\/\d+)['"]\)/)?.[1];
   if (!endpoint) return html;
   const response = JSON.parse(await fetchText(safeUrl(endpoint).href));
   if (typeof response.html !== 'string') throw new Error('Missing Vistry plot HTML');
   const $ = load(html); if ($('#houseTypeContentSection').length) $('#houseTypeContentSection').html(response.html); else $('body').append(response.html); return $.html();
  },
  discoverHomes(html: string, url: string) {
   const $ = load(html); const name = $('h1').first().text().trim().replace(/\s+/g, ' ');
   if (!name) throw new Error('Missing development name');
   const byUrl = new Map<string, PropertyCandidate>();
   $('.house-types__house-type-row,.house-types__house-type-row-featured').each((_, e) => {
    const card = $(e), link = card.find('.house-types__house-type-number a').first(); if (!link.length) return;
    const target = safeUrl(link.attr('href')!); if (!/\/home-[^/]+$/.test(target.pathname) || !target.pathname.startsWith(new URL(url).pathname + '/')) throw new Error('Unexpected Vistry home path');
    const title = link.text().trim().replace(/\s+/g, ' '), text = card.find('.house-types__beds').text().toLowerCase();
    const status = card.attr('data-status') ?? 'unknown';
    byUrl.set(target.href, {externalId: target.pathname, name: title.replace(/^Home\s+\S+\s*-\s*/i, ''), url: target.href, plotNumber: title.match(/^Home\s+(\S+)/i)?.[1], bedrooms: Number(card.attr('data-beds')) || null, price: Number(card.attr('data-price')) || null, propertyType: /apartment|flat/.test(text) ? 'apartment' : 'house', isDetached: /semi/.test(text) ? false : /detached/.test(text) ? true : null, available: /available/i.test(status), status });
   });
   const plots = [...byUrl.values()];
   const galleries: PropertyCandidate[] = $('.development-hero-images__slick img').length ? [{ externalId: new URL(url).pathname, name: name + ' development gallery', url, bedrooms: null, price: null, propertyType: 'development', isDetached: null, available: true, status: 'published gallery' }] : [];
   return {development: {name, url}, homes: [...plots, ...galleries], plots, plotError: null};
  },
  galleryImages(html: string): GalleryImageCandidate[] {
   const $ = load(html); const images: GalleryImageCandidate[] = [], seen = new Set<string>();
   $('.development-hero-images__slick img,.site-plan__image img,.plot-hero-images__slick img,.floor-plans-mobile img,.floor-plans-desktop img').each((_, e) => {
    const img = $(e); if (/show-below/.test(img.attr('class') ?? '')) return;
    const source = img.attr('src') || img.attr('data-src'); if (!source) return;
    const url = new URL(source, origin); if (url.protocol !== 'https:' || ![new URL(origin).hostname, 'accelerated-cf-eunl.mediavalet.com', 'cdn.mediavalet.com', 'mvdataappstorageeunlprod.blob.core.windows.net'].includes(url.hostname)) throw new Error('Unexpected Vistry image origin');
    if (seen.has(url.href)) return; seen.add(url.href); images.push({url: url.href, position: images.length, altText: img.attr('alt')});
   }); return images;
  },
 };
}
