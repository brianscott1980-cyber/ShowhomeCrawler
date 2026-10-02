import outlines from '../../public/maps/uk-outline.json';
import type { CoveragePoint } from './homepage-data';

export function projectLocation({ latitude, longitude }: Pick<CoveragePoint, 'latitude' | 'longitude'>) {
 return { x: (longitude + 9) * Math.cos(55 * Math.PI / 180) * 45 + 20, y: (61.2 - latitude) * 45 + 20 };
}
export function coverageClusters(points: CoveragePoint[]) {
 const clusters = new Map<string, { x: number; y: number; count: number; builder: string }>();
 for (const point of points) {
  const { x, y } = projectLocation(point);
  const key = `${point.builder}:${Math.round(x / 6)}:${Math.round(y / 6)}`;
  const cluster = clusters.get(key);
  if (cluster) { cluster.x += x; cluster.y += y; cluster.count++; }
  else clusters.set(key, { x, y, count: 1, builder: point.builder });
 }
 return [...clusters.values()].map(c => ({ x: c.x / c.count, y: c.y / c.count, count: c.count, builder: c.builder }));
}
export function CoverageMap({ points }: { points: CoveragePoint[] }) {
 const builders = [...new Set(points.map(point => point.builder))].sort();
 const palette = ['#2563eb', '#e95428', '#7c3aed', '#008575', '#c02565', '#b57900', '#0891b2', '#513c9a', '#61862a', '#af432c', '#526275', '#a43d9b', '#176147', '#567bd1', '#d15f94', '#765332'];
 const colours = new Map(builders.map((builder, index) => [builder, palette[index] ?? `hsl(${(index * 137.5) % 360} 65% 40%)`]));
 return <figure className="home-map">
  <svg viewBox="0 36.57 340 533.43" role="img" aria-labelledby="coverage-title coverage-description">
   <title id="coverage-title">Showhome locations across the United Kingdom</title>
   <desc id="coverage-description">{points.length} mapped locations in the collection. Colours identify homebuilders. Larger dots represent nearby locations from the same builder.</desc>
   {outlines.map(outline => <path key={outline.name} d={outline.path} className={outline.name === 'United Kingdom' ? 'map-land' : 'map-context'}/>)}
   {coverageClusters(points).map((c, index) => <circle key={index} cx={c.x} cy={c.y} r={Math.min(5.5, 2.4 + Math.log2(c.count) * .55)} className="map-site" fill={colours.get(c.builder)}><title>{`${c.builder}: ${c.count} ${c.count === 1 ? 'location' : 'nearby locations'}`}</title></circle>)}
  </svg>
 </figure>;
}
