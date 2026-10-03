import { load } from 'cheerio';
import type { DevelopmentCandidate, PropertyCandidate, GalleryImageCandidate } from '../../models/domain.js';
import { parseDevelopment, parsePrice } from './bellway-parser.js';
export function developmentUrls(xml: string): string[] {
 const $ = load(xml, { xmlMode: true });
 return [...new Set($('url > loc').toArray().map(el => $(el).text().trim()).filter(url => /^https:\/\/www\.bellway\.co\.uk\/new-homes\/[^/]+\/[^/]+\/?$/.test(url)).map(url => url.replace(/\/$/, '')))];
}
export function discoverHomes(html: string, url: string) {
 const $ = load(html);
 const canonical = $('link[rel="canonical"]').attr('href');
 if (canonical && /^https:\/\/www\.bellway\.co\.uk\/new-homes\/[^/]+\/[^/]+$/.test(canonical)) url = canonical;
 let development: DevelopmentCandidate = { name: $('h1').first().text().trim() || url.split('/').at(-1)!, url };
 let plots: PropertyCandidate[] = [];
 let plotError: string | null = null;
 try { const result = parseDevelopment(html, url); development = result.development; plots = result.properties; }
 catch { plotError = 'Structured plot source could not be parsed; house-style cards retained.'; }
 development.name = load(development.name).text();
 const homes = new Map<string, PropertyCandidate>();
 $('a[href]').each((_, el) => {
  const href = $(el).attr('href'); if (!href) return;
  let linked: URL; try { linked = new URL(href, url); } catch { return; }
  if (linked.origin !== 'https://www.bellway.co.uk' || !linked.pathname.startsWith(new URL(url).pathname + '/') || linked.pathname.split('/').length !== 5) return;
  linked.search = ''; linked.hash = '';
  const card = $(el).closest('.text-container');
  const description = card.find('.result-description').text();
  const bedroom = description.match(/(\d+)\s*bedroom/i) ?? linked.pathname.match(/-(\d+)-bedroom/);
  if (!bedroom && !card.find('.result-title').length) return;
  const name = card.find('.result-title').text().trim() || $(el).text().trim() || linked.pathname.split('/').at(-1)!;
  const type = description.replace(/^\s*\d+\s*bedroom\s*/i, '').replace(/\s*home\s*$/i, '').trim().toLowerCase() || null;
  homes.set(linked.href, { externalId: 'house-style:' + linked.pathname, name, url: linked.href, bedrooms: bedroom ? Number(bedroom[1]) : null, price: parsePrice(card.find('.result-pricing').text()), propertyType: type, isDetached: type ? type === 'detached' : null, available: true, status: 'advertised_house_style' });
 });
 for (const plot of plots) {
  const home = homes.get(plot.url);
  if (plot.bedrooms === null && home) plot.bedrooms = home.bedrooms;
  if (plot.bedrooms === null) { const bedrooms = plot.url.match(/-(\d+)-bedroom/); if (bedrooms) plot.bedrooms = Number(bedrooms[1]); }
  if (!homes.has(plot.url)) homes.set(plot.url, plot);
 }
 if (!homes.size && !plots.length && !$('h1').length) throw new Error('Unexpected development page.');
 return { development, plots, homes: [...homes.values()], plotError };
}
export function galleryImages(html: string): GalleryImageCandidate[] {
 const $ = load(html);
 const expressions = $('[x-data]').toArray().map(el => $(el).attr('x-data')!).filter(value => value.startsWith('multiImageCarousel('));
 const urls: string[] = [];
 for (const expression of expressions) {
  if (/^multiImageCarousel\(\{\s*images:\s*\[\s*\]\s*\}\)$/.test(expression)) continue;
  const match = expression.match(/JSON\.parse\('((?:\\.|[^'\\])*)'\)/s);
  if (!match) throw new Error('Unknown Bellway gallery encoding.');
  // Decode the single-quoted JS string as JSON string content; never eval.
  const decoded = JSON.parse('"' + match[1]!.replaceAll('"', '\\"') + '"');
  const array: unknown = JSON.parse(decoded);
  if (!Array.isArray(array) || array.some(value => typeof value !== 'string')) throw new Error('Invalid gallery list.');
  urls.push(...array);
 }
 return [...new Set(urls)].map((url, position) => {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'cms.bellway.co.uk') throw new Error('Unexpected gallery image host.');
  const img = $('img').toArray().find(el => $(el).attr('src') === url);
  return { url, position, altText: img ? $(img).attr('alt') : undefined };
 });
}
