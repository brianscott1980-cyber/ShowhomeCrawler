import { readFile } from 'node:fs/promises';
import { developers, readCollection, collectionFolder, assetUrl } from './collections';
import { groupCollections, type Collection } from './groups';
import { isRoomImage } from '../vision/room-classifier';

export interface CoveragePoint { latitude: number; longitude: number; name: string }
export interface HomePhoto { src: string; alt: string; builder: string; category: string }
export async function homepageData() {
 const collections: Collection[] = (await Promise.all(developers.map(async developer => {
  const report = await readCollection(developer.slug);
  return report ? { slug: developer.slug, name: developer.name, report } : null;
 }))).filter(c => c !== null);
 const locations = groupCollections(collections, 'locations');
 const buildings = groupCollections(collections, 'buildings');
 const coordinates = new Map(await Promise.all(collections.map(async c => {
  const rows = await readFile(`${collectionFolder(c.slug)}/locations.json`, 'utf8').then(value => JSON.parse(value) as (CoveragePoint & { url: string })[]).catch(error => {
   if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
   throw error;
  });
  return [c.slug, rows] as const;
 })));
 const points = locations.flatMap(group => {
  const c = group.collections[0]!;
  const url = c.report.properties[0]?.developmentUrl;
  const point = coordinates.get(c.slug)?.find(row => row.url === url);
  return point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
   && point.latitude >= 49.5 && point.latitude <= 61.2 && point.longitude >= -9 && point.longitude <= 2.5
   ? [{ latitude: point.latitude, longitude: point.longitude, name: group.name }] : [];
 });
 const candidates = collections.flatMap(c => c.report.images.filter(image => isRoomImage(image) && image.categorisation?.mainCategory !== 'Exterior' && (image.categorisation?.isRoom || image.verdict?.matches)).map(image => ({ collection: c, image })));
 const selected: typeof candidates = [];
 for (const category of ['Living Room', 'Kitchen', 'Bedroom', 'Study & Home Office']) {
  const options = candidates.filter(c => c.image.categorisation?.mainCategory === category && !selected.some(s => s.image.id === c.image.id && s.collection.slug === c.collection.slug));
  const pick = options.find(c => !selected.some(s => s.collection.slug === c.collection.slug)) ?? options[0];
  if (pick) selected.push(pick);
 }
 for (const item of candidates) {
  if (selected.length >= 4) break;
  if (!selected.some(s => s.collection.slug === item.collection.slug && s.image.id === item.image.id)) selected.push(item);
 }
 const photo = (item: typeof candidates[number]): HomePhoto => ({ src: assetUrl(item.collection.slug, item.image.path), alt: item.image.verdict?.description ?? 'Showhome interior', builder: item.collection.name, category: item.image.categorisation?.mainCategory ?? 'Interior' });
 const exterior = collections.flatMap(c => c.report.images.filter(i => i.categorisation?.mainCategory === 'Exterior').map(image => ({ collection: c, image })))[0];
 const featured: Collection[] = [];
 for (const item of selected) {
  let c = featured.find(c => c.slug === item.collection.slug);
  if (!c) {
   c = { ...item.collection, report: { ...item.collection.report, images: [], properties: [], developments: [], errors: [], metrics: {} } };
   featured.push(c);
  }
  c.report.images.push(item.image);
  c.report.properties.push(...item.collection.report.properties.filter(p => p.imageIds.includes(item.image.id) && !c!.report.properties.includes(p)));
 }
 return {
  hero: selected[0] ? photo(selected[0]) : null,
  journeyPhotos: [exterior ? photo(exterior) : selected[0] ? photo(selected[0]) : null, selected[1] ? photo(selected[1]) : null, selected[2] ? photo(selected[2]) : null],
  featured, points, counts: { locations: locations.length, buildings: buildings.length, builders: collections.filter(c => c.report.images.some(i => i.verdict?.matches)).length },
 };
}
