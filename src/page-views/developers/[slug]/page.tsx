import {CardImage} from '../../../web/card-image';
import {readPresentation} from '../../../database/website';
import type {BuilderOverviewProjection} from '../../../catalogue/builder-overview';
import type {SearchValues} from '../../../web/url-query';
import {BuilderOverviewDetails} from '../../../web/builder-overview-details';
import {readWebsiteBuilder} from '../../../database/website';
import {builderLogoBackground} from '../../../web/builder-brand';
import {BuilderOverviewMap} from '../../../web/builder-overview-map';
import {readLocationRows} from '../../../web/location-geography';
import {groupCollections,spaceName} from '../../../web/groups';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BuilderName } from '../../../web/builder-name';
import { developers, readCollection, assetUrl } from '../../../web/collections';
import { ResultsPage } from '../../../web/results-page';
import { absoluteUrl, jsonLd } from '../../../web/seo';

type Props = { params: Promise<{ slug: string }>; searchParams?:Promise<SearchValues> };
async function collection(slug: string) {
 const developer = developers.find(d => d.slug === slug);
 if (!developer) notFound();
 const overview=await readPresentation<BuilderOverviewProjection>(`builder:${slug}`);
 return {developer,report:overview.report,overview};
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
 const { slug } = await params;
 const { developer, report, overview } = await collection(slug);
 const images = report?.images.filter(i => i.categorisation ? i.categorisation.isRoom || i.categorisation.mainCategory === 'Exterior' : (i.verdict?.matches??true)) ?? [];
 const title = `${developer.name} Showhomes & Interior Ideas | Showhome Explorer`;
 const description = `Explore ${developer.name} new build developments and house types. Compare showhome interiors and discover ideas for your next home or the home you have.`;
 const image = images[0] ? absoluteUrl(assetUrl(slug, images[0].path)) : undefined;
 return { title, description, alternates: { canonical: `/builders/${slug}` }, robots: { index: images.length > 0, follow: true },
  openGraph: { title, description, url: `/builders/${slug}`, ...(image ? { images: [image] } : {}) },
  twitter: { title, description, card: image ? 'summary_large_image' : 'summary', ...(image ? { images: [image] } : {}) } };
}
export default async function Page({ params }: Props) {
 const { slug } = await params;
 const { developer, report, overview } = await collection(slug);
 const images = report?.images.filter(i => i.categorisation ? i.categorisation.isRoom || i.categorisation.mainCategory === 'Exterior' : (i.verdict?.matches??true)) ?? [];
 const schema = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${developer.name} Showhome Ideas`, url: absoluteUrl(`/builders/${slug}`),
  mainEntity: { '@type': 'ItemList', numberOfItems: overview.imageCount, itemListElement: images.slice(0,24).map((image, index) => ({ '@type': 'ListItem', position: index + 1,
   item: { '@type': 'ImageObject', contentUrl: absoluteUrl(assetUrl(slug, image.path)), caption: image.verdict?.description ?? 'Showhome interior' } })) } };
 const locations=overview.locations;
 const collections=report?[{slug,name:developer.name,report}]:[];
 const locationGroups=groupCollections(collections,'locations');
 const buildingGroups=groupCollections(collections,'buildings');
 const roomGroups=groupCollections(collections,'interiors').filter(group=>!['Exterior','Uncategorised'].includes(group.name));
 const interiorImages=roomGroups.flatMap(group=>group.collections.flatMap(collection=>collection.report.images.filter(image=>image.categorisation?image.categorisation.isRoom:Boolean(image.verdict?.matches)&&spaceName(image,collection.report.question)!=='Exterior')));
 const developmentImageIds=new Set(report?.properties.filter(home=>home.developmentUrl).flatMap(home=>home.imageIds)??[]);
 const developmentImages=images.filter(image=>developmentImageIds.has(image.id));
 const buildingImages=buildingGroups.flatMap(group=>group.collections.flatMap(collection=>collection.report.images));
 const pickedImages=new Set<string>();
 function preview(candidates:typeof images,preferExterior=false){
  const unique=[...new Map(candidates.map(image=>[image.id,image])).values()];
  const exteriors=preferExterior?unique.filter(image=>image.categorisation?.mainCategory==='Exterior'):[];
  const pool=exteriors.length?exteriors:unique;
  const unused=pool.filter(image=>!pickedImages.has(image.id));
  const available=unused.length?unused:pool;
  const image=available[Math.floor(Math.random()*available.length)];
  if(image)pickedImages.add(image.id);
  return image;
 }
 const destinations=[
  {path:'developments',label:'View developments',count:locations.length,unit:'developments',image:preview(developmentImages,true)},
  {path:'buildings',label:'View building types',count:overview.counts['Building types'],unit:'building types',image:preview(buildingImages,true)},
  {path:'interiors',label:'View interiors',count:overview.interiors,unit:'interiors',image:preview(interiorImages)},
 ];
 const brand=await readWebsiteBuilder(slug),logo=brand?.logo_url;
 const mapCards=locations.map(location=>({key:`${slug}:${location.url}`,name:location.name,developer:developer.name,latitude:location.latitude,longitude:location.longitude,country:location.geography?.country??null,image:'',description:location.name,count:0,properties:[],href:location.href}));
 return <ResultsPage title={logo?<><span className="sr-only">{developer.name}</span><img className="builder-results-logo" src={logo} alt={`${developer.name} logo`} style={{background:brand?.logo_background??'#fff'}}/></>:<BuilderName name={developer.name}/>} eyebrow={null}
  description={`Discover ${developer.name} developments, explore their house types and find inspiration in their showhome rooms.`}
  builderOverview={{details:<BuilderOverviewDetails slug={slug} website={developer.website} countries={[...new Set(locations.map(location=>location.geography?.country).filter((country):country is string=>Boolean(country)))]}/>,map:<BuilderOverviewMap cards={mapCards}/>,counts:overview.counts}}
  back={{ href: '/builders', label: '← All builders' }} collections={report ? [{ slug, name: developer.name, report }] : []} includeUnclassified>
  <div className="results-heading builder-explore-heading"><h2>Explore {developer.name}</h2></div>
  <nav className="builder-navigation" aria-label={`Explore ${developer.name}`}>
   {destinations.map(destination=><Link key={destination.path} className="builder-navigation-card" href={`/${destination.path}`} data-filters={JSON.stringify({developer:developer.name})}>
    {destination.image?<CardImage src={assetUrl(slug,destination.image.path)} alt="" loading="lazy"/>:<div className="builder-navigation-placeholder">{developer.name}</div>}
    <div className="builder-navigation-content"><h2>{destination.label}<span aria-hidden="true">→</span></h2><p>{destination.count.toLocaleString('en-GB')} {destination.unit}</p></div>
   </Link>)}
  </nav>
  <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}/>
 </ResultsPage>;
}
