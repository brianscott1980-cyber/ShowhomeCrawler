import outlines from '../../public/maps/uk-outline.json';
import type { CoveragePoint } from './homepage-data';

export function projectLocation({ latitude, longitude }: Pick<CoveragePoint, 'latitude' | 'longitude'>) {
 return { x: (longitude + 9) * Math.cos(55 * Math.PI / 180) * 45 + 20, y: (61.2 - latitude) * 45 + 20 };
}
export function coverageClusters(points: CoveragePoint[]) {
 const clusters = new Map<string, { x: number; y: number; count: number }>();
 for (const point of points) {
  const { x, y } = projectLocation(point);
  const key = `${Math.round(x / 6)}:${Math.round(y / 6)}`;
  const cluster = clusters.get(key);
  if (cluster) { cluster.x += x; cluster.y += y; cluster.count++; }
  else clusters.set(key, { x, y, count: 1 });
 }
 return [...clusters.values()].map(c => ({ x: c.x / c.count, y: c.y / c.count, count: c.count }));
}
export function CoverageMap({ points }: { points: CoveragePoint[] }) {
 return <figure className="home-map">
  <svg viewBox="0 0 340 570" role="img" aria-labelledby="coverage-title coverage-description">
   <title id="coverage-title">Showhome locations across the United Kingdom</title>
   <desc id="coverage-description">{points.length} mapped locations in the collection. Larger dots represent several nearby locations.</desc>
   {outlines.map(outline => <path key={outline.name} d={outline.path} className={outline.name === 'United Kingdom' ? 'map-land' : 'map-context'}/>)}
   {coverageClusters(points).map((c, index) => <circle key={index} cx={c.x} cy={c.y} r={Math.min(5.5, 2.4 + Math.log2(c.count) * .55)} className="map-site"/>)}
  </svg>
  <figcaption><span aria-hidden="true"/>Published locations with mapped coordinates</figcaption>
 </figure>;
}
