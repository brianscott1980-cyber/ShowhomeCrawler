import Link from 'next/link';
import { homepageData } from '../web/homepage-data';
import { RollingCount } from '../web/rolling-count';
import { HomepageMap } from '../web/homepage-map';
import { Gallery } from '../web/gallery';
import { absoluteUrl, jsonLd } from '../web/seo';
import './home.css';
export const metadata = { title: 'Showhome Explorer | Explore New Homes & Interior Inspiration', description: 'Discover UK homebuilders, locations and house types. Explore real showhome interiors and save ideas for your home.', alternates: { canonical: '/' } };
export const dynamic = 'force-dynamic';
const journeys = [
 { title: 'Explore homes near you', description: 'Discover locations and the homes behind them, in your area and beyond.', href: '/locations', link: 'Explore locations', number: '01' },
 { title: 'Find decorating inspiration', description: 'From kitchens to cosy bedrooms. Find ideas for every room, across homebuilders.', href: '/interiors', link: 'Browse interiors', number: '02' },
 { title: 'Explore your house type', description: 'See how the same home has been styled in showhomes at different locations.', href: '/buildings', link: 'Find a house type', number: '03' },
];
export default async function Home() {
 const { journeyPhotos, featured, mapPhotos, points, counts } = await homepageData();
 return <main className="homepage">
  <section className="home-hero" aria-labelledby="home-title">
   <div className="home-hero-copy"><img className="home-logo" src="/brand/uk-showhome-explorer.svg" alt="UK Showhome Explorer" width={640} height={152} fetchPriority="high"/><p className="eyebrow">A little inspiration. A place of your own.</p><h1 id="home-title">Explore new homes.<br/><em>Find ideas for yours.</em></h1><p>Discover homebuilders, locations and house types across the UK, with real showhome interiors to inspire you.</p><dl className="home-coverage-counts"><div><dt>Locations</dt><dd><RollingCount value={counts.locations}/></dd></div><div><dt>Homebuilders</dt><dd><RollingCount value={counts.builders}/></dd></div><div><dt>House types</dt><dd><RollingCount value={counts.buildings}/></dd></div></dl><a className="home-button" href="#start-exploring">Find your starting point <span aria-hidden="true">↓</span></a></div>
   <HomepageMap points={points} photos={mapPhotos}/>
  </section>
  <section className="home-journeys" id="start-exploring" aria-labelledby="journeys-title">
   <div className="home-section-heading"><div><p className="eyebrow">Make yourself at home</p><h2 id="journeys-title">Where would you like to begin?</h2></div><Link href="/homebuilders" className="home-text-link">Browse all homebuilders <span aria-hidden="true">↗</span></Link></div>
   <div className="home-journey-grid">{journeys.map((journey, index) => <Link key={journey.href} href={journey.href} className="home-journey">
    {journeyPhotos[index] && <div className="home-journey-photo"><img src={journeyPhotos[index]!.src} alt="" loading="lazy"/></div>}
    <div className="home-journey-copy"><span className="home-step">{journey.number}</span><h3>{journey.title}</h3><p>{journey.description}</p><span className="home-text-link">{journey.link} <span aria-hidden="true">↗</span></span></div>
   </Link>)}</div>
  </section>
  {featured.length > 0 && <section className="home-inspiration" aria-labelledby="inspiration-title">
   <div className="home-section-heading"><div><p className="eyebrow">From the collection</p><h2 id="inspiration-title">Ideas worth saving.</h2></div><Link className="home-text-link" href="/interiors">Explore all interiors <span aria-hidden="true">↗</span></Link></div>
   <Gallery collections={featured} includeUnclassified featured/>
  </section>}
  <section className="home-saved"><div><p className="eyebrow">For your home, in your own time</p><h2>Keep your favourite ideas together.</h2><p>Save the spaces that catch your eye using the heart on any image. Your favourites stay here in this browser, ready when you are.</p></div><Link className="home-button home-button-outline" href="/favourites">Your favourites <span aria-hidden="true">↗</span></Link></section>
  <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Showhome Explorer', url: absoluteUrl('/'), description: metadata.description }) }}/>
 </main>;
}
