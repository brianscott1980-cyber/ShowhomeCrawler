import { load } from 'cheerio';
export async function discoverSitemapDevelopments(url: string, parse: (xml: string) => string[], fetchText: (url: string) => Promise<string>): Promise<string[]> {
 const origin = new URL(url).origin; const visited = new Set<string>(); const found = new Set<string>();
 async function visit(target: string, depth: number): Promise<void> {
  if (visited.has(target)) return;
  if (depth > 3 || visited.size >= 100 || new URL(target).origin !== origin) throw new Error('Sitemap exceeds discovery bounds.');
  visited.add(target); const xml = await fetchText(target);
  for (const candidate of parse(xml)) found.add(candidate);
  const $ = load(xml, { xmlMode: true });
  const children = $('sitemap > loc').map((_, el) => new URL($(el).text().trim(), target).href).get();
  for (const child of children) await visit(child, depth + 1);
 }
 await visit(url, 0); return [...found];
}
