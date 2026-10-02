import { developers, readCollection } from '../../web/collections';
import { Gallery } from '../../web/gallery';
export const dynamic = 'force-dynamic';
export default async function Favourites() {
 const collections = (await Promise.all(developers.map(async d => {
  const report = await readCollection(d.slug); return report ? { slug: d.slug, name: d.name, report } : null;
 }))).filter(c => c !== null);
 return <main><section className="intro compact"><p className="eyebrow">YOUR SAVED SPACES</p><h1>A little inspiration.<br/><em>Kept for later.</em></h1><p>Your favourites from every developer, saved in this browser.</p></section><Gallery collections={collections} favouritesOnly/></main>;
}
