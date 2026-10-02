import { developers, readCollection } from '../../web/collections';
import { ResultsPage } from '../../web/results-page';
export const metadata={title:'Your Saved Interiors | Showhome Explorer',robots:{index:false,follow:true},alternates:{canonical:'/favourites'}};
export const dynamic = 'force-dynamic';
export default async function Favourites() {
 const collections = (await Promise.all(developers.map(async d => {
  const report = await readCollection(d.slug); return report ? { slug: d.slug, name: d.name, report } : null;
 }))).filter(c => c !== null);
 return <ResultsPage title={<>Your favourite<br/>spaces.</>} eyebrow="Your saved interiors" description="Your favourites from every homebuilder, saved in this browser." collections={collections} favouritesOnly/>;
}
