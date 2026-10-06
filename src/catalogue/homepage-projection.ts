import { groupRoutes } from '../web/group-routes';
import {readWebsiteBuilder} from '../database/website';
import {readLocationRows} from '../web/location-geography';
import {builderBrand} from '../web/builder-brand';
import { developers, readCollection, assetUrl } from '../web/collections';
import { groupCollections, type Collection } from '../web/groups';
import { isRoomImage } from '../vision/room-classifier';



export interface CoveragePoint { latitude: number; longitude: number; name: string; builder: string; siteId?: string }
export interface HomePhoto { src: string; alt: string; builder: string; category: string; siteIds?: string[]; logo?: string; logoBackground?: string; houseType?: string; houseTypeHref?: string }
export async function computeHomepageData(loaded?:Collection[]) {
 const collections: Collection[] = loaded??(await Promise.all(developers.map(async developer => {
  const report = await readCollection(developer.slug);
  return report ? { slug: developer.slug, name: developer.name, report } : null;
 }))).filter(c => c !== null);
 const brands=new Map(await Promise.all(collections.map(async c=>[c.slug,await readWebsiteBuilder(c.slug)] as const)));
 const locations = groupCollections(collections, 'locations');
 const buildings = groupCollections(collections, 'buildings');
 const buildingRoutes = groupRoutes('buildings', buildings);
 const photoBuildings = new Map<string, { houseType: string; houseTypeHref: string }>();
 for (const group of buildings) for (const collection of group.collections) for (const image of collection.report.images) {
  const key = `${collection.slug}:${image.id}`;
  if (!photoBuildings.has(key)) photoBuildings.set(key, { houseType: group.name, houseTypeHref: `${buildingRoutes.get(group.key)!}?image=${encodeURIComponent(`${collection.slug}:${image.id}`)}` });
 }
 const coordinates = new Map(await Promise.all(collections.map(async c => {
  const rows = await readLocationRows(c.slug);
  return [c.slug, rows] as const;
 })));
 const points = locations.flatMap(group => {
  const c = group.collections[0]!;
  const url = group.developmentUrl??c.report.properties[0]?.developmentUrl;
  const point = coordinates.get(c.slug)?.find(row => row.url === url);
  return point && typeof point.latitude==='number' && typeof point.longitude==='number' && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
   && point.latitude >= 49.5 && point.latitude <= 61.2 && point.longitude >= -9 && point.longitude <= 2.5
   ? [{ latitude: point.latitude!, longitude: point.longitude!, name: group.name, builder: c.name, siteId: `${c.slug}:${url}` }] : [];
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
 const imageSites=new Map<string,Set<string>>();
 for(const c of collections)for(const property of c.report.properties){
  if(!property.developmentUrl)continue;
  for(const id of property.imageIds){const key=`${c.slug}:${id}`;let sites=imageSites.get(key);if(!sites){sites=new Set();imageSites.set(key,sites);}sites.add(`${c.slug}:${property.developmentUrl}`);}
 }
 const photo = (item: typeof candidates[number]): HomePhoto => ({ ...photoBuildings.get(`${item.collection.slug}:${item.image.id}`), src: assetUrl(item.collection.slug, item.image.path), alt: item.image.verdict?.description ?? 'Showhome interior', builder: item.collection.name, category: item.image.categorisation?.mainCategory ?? 'Interior', logo: brands.get(item.collection.slug)?.logo_url??undefined, logoBackground: brands.get(item.collection.slug)?.logo_background??'#fff', siteIds: [...(imageSites.get(`${item.collection.slug}:${item.image.id}`)??[])] });
 const mappedSites = new Set(points.map(point => point.siteId));
 const mapPhotos = collections.flatMap(collection => {
  const options = candidates.filter(item => item.collection.slug === collection.slug && photoBuildings.has(`${collection.slug}:${item.image.id}`) && [...(imageSites.get(`${collection.slug}:${item.image.id}`)??[])].some(siteId => mappedSites.has(siteId)));
  const categories = [...new Set(options.map(item => item.image.categorisation?.mainCategory))];
  return categories.slice(0, 4).flatMap(category => {
   const rooms = options.filter(item => item.image.categorisation?.mainCategory === category);
   return rooms.filter((_, index) => index === 0 || index === Math.floor(rooms.length / 2)).map(photo);
  });
 });
 const exterior = collections.flatMap(c => c.report.images.filter(i => i.categorisation?.mainCategory === 'Exterior').map(image => ({ collection: c, image })))[0];
 const featured: Collection[] = [];
 const inspiration = [...candidates];
 for (let index = inspiration.length - 1; index > 0; index--) {
  const other = Math.floor(Math.random() * (index + 1));
  [inspiration[index], inspiration[other]] = [inspiration[other]!, inspiration[index]!];
 }
 for (const item of inspiration.slice(0, 20)) {
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
  featured, mapPhotos, points, counts: { locations: locations.length, buildings: buildings.length, builders: collections.filter(c => c.report.images.some(i => i.categorisation ? i.categorisation.isRoom || i.categorisation.mainCategory === 'Exterior' : i.verdict?.matches)).length },
 };
}

