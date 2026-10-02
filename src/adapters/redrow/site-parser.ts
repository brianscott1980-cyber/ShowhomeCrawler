import { load } from 'cheerio';
import type { PropertyCandidate, GalleryImageCandidate } from '../../models/domain.js';
const origin='https://www.redrow.co.uk';

export function developmentUrls(xml: string): string[] {
 const $ = load(xml, { xmlMode: true }); const urls = new Set<string>();
 $('url > loc, a[href]').each((_, el) => { const url = new URL($(el).attr('href') ?? $(el).text().trim(), origin); if (url.origin === origin && /^\/new-homes\/devr\d+-[^/]+\/$/.test(url.pathname)) urls.add(url.href); });
 return [...urls];
}
export function discoverHomes(html: string, url: string) {
 const $ = load(html); const name = $('h1').first().text().trim();
 if (!name || !$('[data-page-type="development"], .plot-list').length) throw new Error('Unexpected development page.');
 let unlinkedPlots = 0;
 const plots: PropertyCandidate[] = []; const seen = new Set<string>();
 $('.plot-list__plot a.plot').each((_, el) => {
  const card = $(el); const href = card.attr('href'); if (!href) return;
  const linked = new URL(href, url); if (linked.href === origin || linked.href === origin + '/') { unlinkedPlots++; return; } const developmentId = (path: string) => path.match(/^\/new-homes\/(devr\d+)-/)?.[1] ;
  if (linked.origin !== origin || developmentId(linked.pathname) !== developmentId(new URL(url).pathname) || !/^\/new-homes\/devr\d+-[^/]+\/[^/]+\/$/.test(linked.pathname)) throw new Error('Unexpected plot URL.');
  if (seen.has(linked.href)) return; seen.add(linked.href);
  const text = card.find('.plot__features').text(); const beds = text.match(/(\d+)\s*bed/i); const price = text.match(/£\s*([\d,]+)/);
  const house = card.find('.plot__sales-name').text().trim(); const reserved = /reserved|sold/i.test(card.find('.plot__status-container').text());
  plots.push({ externalId: 'plot:' + linked.pathname, houseTypeExternalId: house.toLowerCase().replace(/\W+/g, '-'), name: house || card.find('h3').text().trim(), url: linked.href, plotNumber: card.find('h3').text().match(/Plot\s+(\S+)/i)?.[1], bedrooms: beds ? Number(beds[1]) : null, price: price ? Number(price[1]!.replaceAll(',', '')) : null, propertyType: 'house', isDetached: null, available: !reserved, status: reserved ? 'reserved' : 'available' });
 });
 return { development: { name, url }, plots, homes: plots, plotError: unlinkedPlots ? `${unlinkedPlots} plot cards have no details link; galleries unavailable.` : null };
}
export function galleryImages(html: string): GalleryImageCandidate[] {
 const $=load(html);if(!$('.marketing-header-redrow--plot').length)throw new Error('Unexpected house style gallery page');const images=new Map<string,GalleryImageCandidate>();$('[data-component="LightboxModal"][data-images]').each((_,e)=>{const data=JSON.parse($(e).attr('data-images')!);if(!Array.isArray(data))throw new Error('Missing gallery image array');for(const p of data){if(p.VideoUrl||!p.Src)continue;const u=new URL(p.Src,origin);if(u.origin!==origin||!u.pathname.startsWith('/-/media/'))throw new Error('Unexpected gallery host');if(!images.has(u.pathname))images.set(u.pathname,{url:u.href,position:images.size,altText:p.Alt});}});return [...images.values()];
}
