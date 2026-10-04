import logos from '../../../../public/logos/sources.json';
import {builderLogoBackground} from '../../../web/builder-brand';
import {BuilderOverviewMap} from '../../../web/builder-overview-map';
import {readLocationRows} from '../../../web/location-geography';
import {groupCollections} from '../../../web/groups';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BuilderName } from '../../../web/builder-name';
import { developers, readCollection, assetUrl } from '../../../web/collections';
import { ResultsPage } from '../../../web/results-page';
import { absoluteUrl, jsonLd } from '../../../web/seo';

type Props = { params: Promise<{ slug: string }> };
async function collection(slug: string) {
 const developer = developers.find(d => d.slug === slug);
 if (!developer) notFound();
 return { developer, report: await readCollection(slug) };
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
 const { slug } = await params;
 const { developer, report } = await collection(slug);
 const images = report?.images.filter(i => i.categorisation ? i.categorisation.isRoom || i.categorisation.mainCategory === 'Exterior' : i.verdict?.matches) ?? [];
 const title = `${developer.name} Showhome Ideas | Showhome Explorer`;
 const description = `Explore ${images.length} ${developer.name} showhome photographs for home inspiration. Discover house types, developments and individual plot details.`;
 const image = images[0] ? absoluteUrl(assetUrl(slug, images[0].path)) : undefined;
 return { title, description, alternates: { canonical: `/developers/${slug}` }, robots: { index: images.length > 0, follow: true },
  openGraph: { title, description, url: `/developers/${slug}`, ...(image ? { images: [image] } : {}) },
  twitter: { title, description, card: image ? 'summary_large_image' : 'summary', ...(image ? { images: [image] } : {}) } };
}
export default async function Page({ params }: Props) {
 const { slug } = await params;
 const { developer, report } = await collection(slug);
 const images = report?.images.filter(i => i.categorisation ? i.categorisation.isRoom || i.categorisation.mainCategory === 'Exterior' : i.verdict?.matches) ?? [];
 const schema = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${developer.name} Showhome Ideas`, url: absoluteUrl(`/developers/${slug}`),
  mainEntity: { '@type': 'ItemList', numberOfItems: images.length, itemListElement: images.map((image, index) => ({ '@type': 'ListItem', position: index + 1,
   item: { '@type': 'ImageObject', contentUrl: absoluteUrl(assetUrl(slug, image.path)), caption: image.verdict?.description ?? 'Showhome interior' } })) } };
 const locations=await readLocationRows(slug);
 const collections=report?[{slug,name:developer.name,report}]:[];
 const locationGroups=groupCollections(collections,'locations');
 const logo=logos.find(item=>item.slug===slug);
 const mapCards=locations.map(location=>({key:`${slug}:${location.url}`,name:location.name,developer:developer.name,latitude:location.latitude,longitude:location.longitude,country:location.geography?.country??null,image:'',description:location.name,count:0,properties:[],href:(()=>{const group=locationGroups.find(group=>group.collections.some(collection=>collection.report.properties.some(home=>home.developmentUrl===location.url)));return group?`/locations/${group.key}`:`/locations?developer=${encodeURIComponent(developer.name)}`;})()}));
 return <ResultsPage title={logo?<><span className="sr-only">{developer.name}</span><img className="builder-results-logo" src={`/logos/${logo.file}`} alt={`${developer.name} logo`} style={{background:builderLogoBackground(developer.slug)}}/></>:<BuilderName name={developer.name}/>} eyebrow={null}
  description={`Discover ${developer.name} developments, explore their house types and find inspiration in their showhome rooms.`}
  builderOverview={{map:<BuilderOverviewMap cards={mapCards}/>,counts:{Locations:locations.length,'Building types':groupCollections(collections,'buildings').length,'Room types':groupCollections(collections,'interiors').filter(group=>group.name!=='Exterior'&&group.name!=='Uncategorised').length}}}
  back={{ href: '/homebuilders', label: '← All builders' }} collections={report ? [{ slug, name: developer.name, report }] : []} includeUnclassified>
  {report ? <div className="download-links"><a href={assetUrl(slug, 'matches.csv')}>Download matches</a><a href={assetUrl(slug, 'full-report.html')}>Full results &amp; coverage</a></div> : <p className="empty">Interiors from {developer.name} are coming soon.</p>}
  <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}/>
 </ResultsPage>;
}
