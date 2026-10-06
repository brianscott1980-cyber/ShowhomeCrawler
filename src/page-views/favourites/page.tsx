import { developers, readCollection } from '../../web/collections';
import { ResultsPage } from '../../web/results-page';
export const metadata={title:'Your Saved Interiors | Showhome Explorer',robots:{index:false,follow:true},alternates:{canonical:'/favourites'}};
export default async function Favourites() {
 const galleryPage={images:[],total:0,nextOffset:0,hasMore:false,counts:{'Unique images':0,Developments:0,Properties:0},facets:{category:[],room:[],developer:[],bedrooms:[],location:[],site:[],development:[]}};
 return <ResultsPage title={<>Your favourite<br/>spaces.</>} eyebrow="Your saved interiors" description="Your favourites from every homebuilder, saved in this browser." collections={[]} galleryScope={{kind:'favourites',href:'/favourites'}} galleryPage={galleryPage} favouritesOnly/>;
}
