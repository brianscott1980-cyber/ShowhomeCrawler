import { load } from 'cheerio';
import type { PropertyCandidate, GalleryImageCandidate } from '../../models/domain.js';
const origin = 'https://www.taylorwimpey.co.uk';
export function developmentUrls(xml: string) {
 const $ = load(xml, { xmlMode: true }); const urls = new Set<string>();
 $('url > loc').each((_, el) => { const u = new URL($(el).text().trim()); if (u.origin === origin && /^\/new-homes\/[^/]+\/[^/]+\/?$/.test(u.pathname)) urls.add(u.href); }); return [...urls];
}
export function discoverHomes(html: string, url: string) {
 const $ = load(html); const name = $('h1').first().text().trim();
 const raw = $('development-plots-list').attr(':vm');
 if (!name) throw new Error('Missing development name.');
 if (!raw) {
  if (/Proposed|Coming soon|sold out/i.test($('title').text() + $('main').text())) return { development: { name, url }, homes: [] as PropertyCandidate[], plots: [] as PropertyCandidate[], plotError: 'No current plot list exposed (proposed, coming soon or sold out).' };
  throw new Error('No supported development plot data.');
 }
 const data = JSON.parse(raw); if (!Array.isArray(data.Plots)) throw new Error('Missing plot list.');
 const unlinked = data.Plots.filter((p: any) => !p.PlotPageUrl).length;
 const plots: PropertyCandidate[] = data.Plots.filter((p: any) => p.PlotPageUrl).map((p: any) => {
  const u = new URL(p.PlotPageUrl, origin); if (u.origin !== origin || !u.pathname.startsWith(new URL(url).pathname.replace(/\/$/, '') + '/')) throw new Error('Unexpected plot host.');
  const amount = p.Price?.Value ?? p.Price ?? p.PlotPrice ?? p.FormattedPrice;
  return { externalId: 'plot:' + u.pathname, houseTypeExternalId: p.HouseType.toLowerCase().replace(/\W+/g, '-'), name: p.HouseType, url: u.href, plotNumber: String(p.PlotNumber), bedrooms: Number(p.NoOfBedrooms) || null, price: typeof amount === 'number' ? amount : Number(String(amount ?? '').replace(/[^\d.]/g, '')) || null, propertyType: p.PropertyType ?? null, isDetached: p.PropertyType?.toLowerCase() === 'detached', available: !/reserved|sold/i.test(p.Status ?? ''), status: p.Status ?? 'advertised' };
 });
 return { development: { name, url }, homes: plots, plots, plotError: unlinked ? `${unlinked} plot cards have no details URL.` : null };
}
export function galleryImages(html: string): GalleryImageCandidate[] {
 const $ = load(html.replace(/<\/?template\b[^>]*>/gi, '')); const images = new Map<string, GalleryImageCandidate>();
 $('image-gallery-image, smart-media-gallery-swiper [data-is-video="false"] img').each((_, el) => { const raw = $(el).attr('url') ?? $(el).attr('data-src'); if (!raw) return; const u = new URL(raw, origin); if (u.origin !== origin || !u.pathname.startsWith('/-/twdxmedia/')) throw new Error('Unexpected gallery host.'); if (!/\.(jpg|jpeg|png|webp)(\?|$)/i.test(u.href)) return; const key = u.pathname; if (!images.has(key)) images.set(key, { url: u.href, position: images.size, altText: $(el).attr('alt') }); }); return [...images.values()];
}
