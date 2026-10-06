import {queryDirectory} from '../../database/directory-query';
import {readDirectoryCards,readPresentation} from '../../database/website';
import {DirectoryCountProvider,DirectoryCounts} from '../../web/directory-counts';
import {absoluteUrl,jsonLd} from '../../web/seo';
import {DeveloperDirectory,type DeveloperCard} from '../../web/directory';
export const metadata={title:'Builders | Showhome Explorer',description:'Explore showhome interiors from UK housebuilders.',alternates:{canonical:'/builders'}};
export default async function Builders(){
 const initial=await queryDirectory({kind:'builders'}),collections=initial.cards,counts=initial.counts;
 const schema={'@context':'https://schema.org','@type':'CollectionPage',name:'Builders',url:absoluteUrl('/builders'),description:'UK showhome interiors and home office inspiration'};
 return <DirectoryCountProvider><main>
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(schema)}}/>
  <section className="intro directory-intro" aria-labelledby="builders-heading">
   <div className="directory-intro-heading">
    <h1 id="builders-heading">Builders</h1>
    <p>Explore UK builders and discover their showhome interiors.</p>
    <DirectoryCounts initial={counts}/>
   </div>
   <div className="directory-intro-feature">
    <h2>Discover new homes and fresh interior ideas.</h2>
    <p>Find your next new build home or inspiration for the home you have. Explore UK builders and their developments, compare showhome interiors—from welcoming kitchens to restful bedrooms—and save your favourites.</p>
   </div>
  </section>
  <DeveloperDirectory cards={collections} initial={initial}/>
 </main></DirectoryCountProvider>;
}
