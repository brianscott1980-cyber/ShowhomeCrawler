import { developers, readCollection, assetUrl } from '../../../web/collections';
import { matchedPage } from '../../../reports/matched-page';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 const developer = developers.find(d => d.slug === slug);
 if (!developer) return new Response('Not found', { status: 404 });
 const report = await readCollection(slug);
 const collection = report ?? {
  status: 'coming_soon', startedAt: '', model: '', question: '',
  developments: [], properties: [], images: [], errors: [], metrics: {},
 };
 const html = matchedPage({
  ...collection,
  builder: { name: developer.name, slug, websiteUrl: developer.website },
  images: collection.images.map(image => ({ ...image, path: assetUrl(slug, image.path) })),
 }, false, {
  gateway: '/', favourites: '/favourites', explorerHeader: true,
  fullReport: assetUrl(slug, 'full-report.html'), matches: assetUrl(slug, 'matches.csv'),
 });
 return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
