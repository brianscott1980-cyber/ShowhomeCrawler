import { assetUrl, developers, readCollection } from '../web/collections';
export const dynamic = 'force-dynamic';
export default async function Home() {
 const collections = await Promise.all(developers.map(async developer => ({ ...developer, report: await readCollection(developer.slug) })));
 return <main><section className="intro"><h1>Showhome Explorer</h1><p>Discover interiors. Find inspiration.</p></section><div className="collection-grid">{collections.map(({ slug, name, report }) => {
  const matches = report?.images.filter(i => i.verdict?.matches) ?? [];
  const hero = matches[0];
  return <a className="collection-card" href={`/developers/${slug}`} key={slug}>{hero ? <img src={assetUrl(slug, hero.path)} alt={hero.verdict?.description ?? 'Showhome interior'}/> : <div className="placeholder">Inspiration awaits</div>}<div className="card-body"><p className="eyebrow">THE DEVELOPER COLLECTION</p><h2>{name}<span>↗</span></h2><p>{matches.length} inspiring spaces</p><span className="subtle">Explore collection →</span></div></a>;
 })}</div></main>;
}
