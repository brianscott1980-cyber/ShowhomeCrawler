import {builderNameHtml} from '../../../web/builder-brand';
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
 return new Response(html.replace(/(<a class="developer-name"[^>]*>).*?(<\/a>)/, (_match,open,close)=>open+builderNameHtml(slug,'#15243a')+close).replace('<div class="nav-actions">','<div class="nav-actions"><a class="browse-link" href="/">Homebuilders</a><a class="browse-link" href="/locations">Locations</a><a class="browse-link" href="/interiors">Interiors</a><a class="browse-link" href="/buildings">Buildings</a>').replace(/<title>.*?<\/title>/, `<title>${developer.name} Showhome &amp; Home Office Ideas | Showhome Explorer</title>`).replace('</head>', `${seo}<style>.nav{flex-wrap:wrap}.developer-name{position:static;transform:none;order:3;width:100%;text-align:center;margin-top:16px}.nav-actions{flex-wrap:wrap;justify-content:flex-end}.nav-actions .browse-link{font-size:13px}</style>${analyticsMarkup}</head>`), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
