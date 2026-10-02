import outlines from '../../public/maps/uk-outline.json';
import type { CoveragePoint } from './homepage-data';

export function projectLocation({ latitude, longitude }: Pick<CoveragePoint, 'latitude' | 'longitude'>) {
 return { x: (longitude + 9) * Math.cos(55 * Math.PI / 180) * 45 + 20, y: (61.2 - latitude) * 45 + 20 };
}
export function coverageClusters(points: CoveragePoint[], activeSiteIds: string[] = []) {
 const activeSites = new Set(activeSiteIds);
 const clusters = new Map<string, { x: number; y: number; count: number; builder: string; siteIds: string[] }>();
 for (const point of points) {
  const { x, y } = projectLocation(point);
  const siteId = point.siteId ?? `${point.builder}:${point.name}`;
  const key = activeSites.has(siteId) ? siteId : `${point.builder}:${Math.round(x / 6)}:${Math.round(y / 6)}`;
  const cluster = clusters.get(key);
  if (cluster) { cluster.x += x; cluster.y += y; cluster.count++; cluster.siteIds.push(siteId); }
  else clusters.set(key, { x, y, count: 1, builder: point.builder, siteIds: [siteId] });
 }
 return [...clusters.values()].map(c => ({ x: c.x / c.count, y: c.y / c.count, count: c.count, builder: c.builder, siteIds: c.siteIds }));
}
export function CoverageMap({ points, activeSiteIds = [] }: { points: CoveragePoint[]; activeSiteIds?: string[] }) {
 const builders = [...new Set(points.map(point => point.builder))].sort();
 const palette = ['#2563eb', '#e95428', '#7c3aed', '#008575', '#c02565', '#b57900', '#0891b2', '#513c9a', '#61862a', '#af432c', '#526275', '#a43d9b', '#176147', '#567bd1', '#d15f94', '#765332'];
 const colours = new Map(builders.map((builder, index) => [builder, palette[index] ?? `hsl(${(index * 137.5) % 360} 65% 40%)`]));
 return <figure className={`home-map${activeSiteIds.length ? ' has-active-sites' : ''}`}>
  <svg viewBox="-20 36.57 340 487.5" role="img" aria-label="Showhome locations across the United Kingdom" aria-describedby="coverage-description">
   <desc id="coverage-description">{points.length} mapped locations in the collection. Colours identify builders. Enlarged dots identify locations associated with the displayed photo.</desc>
   {outlines.map(outline => <path key={outline.name} d={outline.path} className={outline.name === 'United Kingdom' ? 'map-land' : 'map-context'}/>)}
   {coverageClusters(points, points.map(point => point.siteId ?? `${point.builder}:${point.name}`)).sort((a, b) => Number(a.siteIds.some(id => activeSiteIds.includes(id))) - Number(b.siteIds.some(id => activeSiteIds.includes(id)))).map(c => <circle key={c.siteIds.join('|')} cx={c.x.toFixed(3)} cy={c.y.toFixed(3)} r={Math.min(5.5, 2.4 + Math.log2(c.count) * .55)} className={`map-site${c.siteIds.some(id => activeSiteIds.includes(id)) ? ' is-active-site' : ''}`} fill={colours.get(c.builder)} aria-label={`${c.builder}: ${c.count} ${c.count === 1 ? 'location' : 'nearby locations'}`}/>)}
  </svg>
 </figure>;
}
