import {builderFacts} from '../../web/builder-facts';
import {builderLogoBackground} from '../../web/builder-brand';
import {homeTypeName} from '../../reports/home-display';
import {DirectoryCountProvider,DirectoryCounts} from '../../web/directory-counts';
import {cardImageCollection,reportCardImage} from '../../web/card-images';
import logos from '../../../public/logos/sources.json';
import {developers,readCollection} from '../../web/collections';
import {absoluteUrl,jsonLd} from '../../web/seo';
import {readLocationRows} from '../../web/location-geography';
import {groupCollections,type Collection} from '../../web/groups';
import {DeveloperDirectory,type DeveloperCard} from '../../web/directory';
export const metadata={title:'Builders | Showhome Explorer',description:'Explore showhome interiors from UK housebuilders.',alternates:{canonical:'/homebuilders'}};
export default async function Builders(){
 const reports:Collection[]=[];
 const cards=await Promise.all(developers.map(async developer=>{
  const report=await readCollection(developer.slug);if(!report)return null;const matches=report?.images.filter(i=>i.categorisation?(i.categorisation.isRoom||i.categorisation.mainCategory==='Exterior'):i.verdict?.matches)??[];const hero=matches[0];if(!hero)return null;reports.push({slug:developer.slug,name:developer.name,report});
  const locations=await readLocationRows(developer.slug);
  const publishedLocations=new Set(groupCollections([{slug:developer.slug,name:developer.name,report}],'locations').flatMap(group=>group.collections.flatMap(collection=>collection.report.properties.map(home=>home.developmentUrl))));
  const logo=logos.find(l=>l.slug===developer.slug);
  const logoUrl=logo?`/logos/${logo.file}`:undefined;
  const logoBackground=builderLogoBackground(developer.slug);
  return {...builderFacts(developer.slug),slug:developer.slug,name:developer.name,spaces:matches.length,logo:logoUrl,
   ...cardImageCollection(matches.map(i=>reportCardImage(developer.slug,i)),logoUrl?{src:logoUrl,alt:`${developer.name} logo`,kind:'logo',background:logoBackground}:undefined),locations:locations.filter(p=>publishedLocations.has(p.url)).map(p=>({...p,key:`${developer.slug}:${p.url}`,region:p.geography?.region||p.geography?.country||'Unknown',buildingTypes:[...new Set(report.properties.filter(home=>home.developmentUrl===p.url).map(home=>homeTypeName(home.name).toLowerCase()))]}))} as DeveloperCard;
 }));
 const collections=cards.filter((c):c is DeveloperCard=>c!==null);
 const locationCount=groupCollections(reports,'locations').length;
 const buildingTypeCount=groupCollections(reports,'buildings').length;
 const schema={'@context':'https://schema.org','@type':'CollectionPage',name:'Builders',url:absoluteUrl('/homebuilders'),description:'UK showhome interiors and home office inspiration'};
 return <DirectoryCountProvider><main>
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(schema)}}/>
  <section className="intro directory-intro" aria-labelledby="builders-heading">
   <div className="directory-intro-heading">
    <h1 id="builders-heading">Builders</h1>
    <p>Explore UK builders and discover their showhome interiors.</p>
    <DirectoryCounts initial={{Builders:collections.length,Developments:locationCount,'Building types':buildingTypeCount}}/>
   </div>
   <div className="directory-intro-feature">
    <h2>Discover each builder’s sense of home.</h2>
    <p>Explore how UK builders bring their showhomes to life—from welcoming kitchens to restful bedrooms. Compare their interiors, find ideas you love, and save your favourites.</p>
   </div>
  </section>
  <DeveloperDirectory cards={collections}/>
 </main></DirectoryCountProvider>;
}
