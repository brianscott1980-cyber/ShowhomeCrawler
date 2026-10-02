import { developers, readCollection, assetUrl } from '../../../web/collections';
import { developerSeo } from '../../../web/seo';
import { analyticsMarkup } from '../../../web/analytics';
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
 const seo=developerSeo(developer.name,slug,collection.images.filter(i=>i.verdict?.matches).map(i=>({path:assetUrl(slug,i.path),description:i.verdict?.description})));
 const html = matchedPage({
  ...collection,
  builder: { name: developer.name, slug, websiteUrl: developer.website },
  images: collection.images.map(image => ({ ...image, path: assetUrl(slug, image.path) })),
 }, false, {
  gateway: '/', favourites: '/favourites', explorerHeader: true,
  fullReport: assetUrl(slug, 'full-report.html'), matches: assetUrl(slug, 'matches.csv'),
 });
 return new Response(html.replace(/<title>.*?<\/title>/, `<title>${developer.name} Showhome &amp; Home Office Ideas | Showhome Explorer</title>`).replace('</head>', `${seo}${analyticsMarkup}</head>`), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
