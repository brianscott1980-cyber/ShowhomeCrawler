import {notFound} from 'next/navigation';
import {readFurnishings} from '../database/furnishings';
import {cachedGallery} from '../database/gallery-cache';
import {FurnishingCards} from './furnishing-cards';
import {ResultsPage} from './results-page';
import {searchListing} from './seo';
import {DirectoryCountProvider,DirectoryCounts} from './directory-counts';
export const furnishingsMetadata=searchListing('Furnishings','Explore furniture, lighting and accessories in real showhome interiors. Compare furnishings and find inspiration for your home.','/furnishings');
export async function furnishingItem(slug:string){return (await readFurnishings()).find(item=>decodeURIComponent(item.slug)===decodeURIComponent(slug).toLowerCase());}
export async function FurnishingsPage({slug}:{slug?:string}){
 if(slug){
  const item=await furnishingItem(slug);if(!item)notFound();
  const scope={kind:'interiors' as const,href:'/interiors/all',furnishing:decodeURIComponent(item.slug)};
  const initial=await cachedGallery({scope});
  return <ResultsPage title={item.name} description={`Explore ${item.name.toLowerCase()} in real showhome interiors. Compare ideas, colours and styles for your own home.`} eyebrow={null} collections={[]} places={{}} galleryScope={scope} galleryPage={initial} back={{href:'/furnishings',label:'← All Furnishings'}}/>;
 }
 const items=await readFurnishings();
 return <DirectoryCountProvider><main><section className="intro directory-intro furnishings-directory-intro"><div className="directory-intro-heading"><h1>Furnishings</h1><p>Discover furniture, lighting and accessories in real showhomes.</p><DirectoryCounts initial={{Furnishings:items.length}}/></div><div className="directory-intro-feature"><h2>Find the details you love.</h2><p>Discover how furnishings bring a room together. Browse items across showhomes, compare styles and save inspiration for your own home.</p></div></section><FurnishingCards items={items}/></main></DirectoryCountProvider>;
}
