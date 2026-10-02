import { load } from 'cheerio';
import { z } from 'zod';
import type { DevelopmentCandidate, PropertyCandidate } from '../../models/domain.js';
const plotSchema = z.object({ id: z.string(), houseStyleId: z.string(), houseStyleSlug: z.string(), number: z.union([z.number(), z.string()]), available: z.boolean(), price: z.string().nullable(), houseStyleName: z.string(), unitType: z.string() });
export function parsePrice(input: string | null): number | null {
 if (!input) return null;
 const match = input.match(/£\s*([\d,]+(?:\.\d{2})?)/);
 return match ? Number(match[1]!.replaceAll(',', '')) : null;
}
// Extract a JSON object without executing Alpine's JavaScript expression.
function jsonObject(expression: string): unknown {
 const start = expression.indexOf('{');
 if (start < 0) throw new Error('Bellway plot data is missing.');
 let depth = 0, quoted = false, escaped = false;
 for (let i = start; i < expression.length; i++) {
  const c = expression[i];
  if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; }
  else if (c === '"') quoted = true;
  else if (c === '{') depth++;
  else if (c === '}' && --depth === 0) return JSON.parse(expression.slice(start, i + 1));
 }
 throw new Error('Bellway plot data is malformed.');
}
export function parseDevelopment(html: string, url: string): { development: DevelopmentCandidate; properties: PropertyCandidate[] } {
 const $ = load(html);
 let place: { name: string; address?: { postalCode?: string; addressLocality?: string } } | undefined;
 $('script[type="application/ld+json"]').each((_, el) => {
  try { const data = JSON.parse($(el).text());
   place ??= data['@graph']?.find((item: Record<string, unknown>) => item['@type'] === 'Place' && item.url === url);
  } catch { /* Other structured blocks may not be valid JSON. */ }
 });
 if (!place?.name) throw new Error('Bellway development metadata is missing.');
 const expression = $('[x-data="developmentSiteplan"]').attr('x-init');
 if (!expression) throw new Error('Bellway siteplan plot source is missing.');
 const groups = z.record(z.string(), z.array(plotSchema)).parse(jsonObject(expression));
 const properties = new Map<string, PropertyCandidate>();
 for (const plot of Object.values(groups).flat()) {
  const propertyUrl = new URL(`${url}/${plot.houseStyleSlug}`);
  if (propertyUrl.origin !== new URL(url).origin || !propertyUrl.pathname.startsWith(new URL(url).pathname + '/')) throw new Error('Unexpected house style URL.');
  const link = $('a[href]').filter((_, el) => $(el).attr('href') === propertyUrl.pathname).first();
  const description = link.closest('.text-container').find('.result-description').text();
  const bedroomMatch = description.match(/(\d+)\s*bedroom/i);
  properties.set(plot.id, { externalId: plot.id, houseTypeExternalId: plot.houseStyleId,
   name: plot.houseStyleName, url: propertyUrl.href, plotNumber: String(plot.number),
   bedrooms: bedroomMatch ? Number(bedroomMatch[1]) : null, price: parsePrice(plot.price),
   propertyType: plot.unitType.toLowerCase(), isDetached: plot.unitType.toLowerCase() === 'detached',
   available: plot.available, status: plot.available ? 'available' : 'unavailable' });
 }
 return { development: { name: place.name, url, postcode: place.address?.postalCode, locationText: place.address?.addressLocality }, properties: [...properties.values()] };
}
