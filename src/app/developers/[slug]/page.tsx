import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BuilderName } from '../../../web/builder-name';
import { developers, readCollection, assetUrl } from '../../../web/collections';
import { ResultsPage } from '../../../web/results-page';
import { absoluteUrl, jsonLd } from '../../../web/seo';

type Props = { params: Promise<{ slug: string }> };
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
async function collection(slug: string) {
 const developer = developers.find(d => d.slug === slug);
 if (!developer) notFound();
 return { developer, report: await readCollection(slug) };
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
 const { slug } = await params;
 const { developer, report } = await collection(slug);
 const images = report?.images.filter(i => i.verdict?.matches) ?? [];
 const title = `${developer.name} Showhome & Home Office Ideas | Showhome Explorer`;
 const description = `Explore ${images.length} ${developer.name} showhome interior photographs for home office inspiration. Discover house types, development locations and individual plot details.`;
 const image = images[0] ? absoluteUrl(assetUrl(slug, images[0].path)) : undefined;
 return { title, description, alternates: { canonical: `/developers/${slug}` }, robots: { index: images.length > 0, follow: true },
  openGraph: { title, description, url: `/developers/${slug}`, ...(image ? { images: [image] } : {}) },
  twitter: { title, description, card: image ? 'summary_large_image' : 'summary', ...(image ? { images: [image] } : {}) } };
}
export default async function Page({ params }: Props) {
 const { slug } = await params;
 const { developer, report } = await collection(slug);
 const images = report?.images.filter(i => i.verdict?.matches) ?? [];
 const schema = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${developer.name} Showhome & Home Office Ideas`, url: absoluteUrl(`/developers/${slug}`),
  mainEntity: { '@type': 'ItemList', numberOfItems: images.length, itemListElement: images.map((image, index) => ({ '@type': 'ListItem', position: index + 1,
   item: { '@type': 'ImageObject', contentUrl: absoluteUrl(assetUrl(slug, image.path)), caption: image.verdict?.description ?? 'Showhome interior' } })) } };
 return <ResultsPage title={<>Room to work<br/>from home.</>} eyebrow={<a href={developer.website} target="_blank" rel="noreferrer"><BuilderName name={developer.name}/></a>}
  description={`Explore studies and home offices in ${developer.name} homes with five or more bedrooms. A desk, a place to focus — and no bed in sight.`}
  back={{ href: '/homebuilders', label: '← All homebuilders' }} collections={report ? [{ slug, name: developer.name, report }] : []}>
  {report ? <div className="download-links"><a href={assetUrl(slug, 'matches.csv')}>Download matches</a><a href={assetUrl(slug, 'full-report.html')}>Full results &amp; coverage</a></div> : <p className="empty">Interiors from {developer.name} are coming soon.</p>}
  <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}/>
 </ResultsPage>;
}
