import { describe, expect, it } from 'vitest';
import { groupRoutes, routeSlug } from '../src/web/group-routes';
import type { Group } from '../src/web/groups';
import { withFilters } from '../src/web/url-query';
const group = (key: string, slug: string, name: string, url = 'https://example.com/site'): Group => ({ key, name, developers: [slug], count: 1,
 collections: [{ slug, name: slug, report: { status: 'completed', startedAt: '', model: '', question: '', developments: [], images: [], errors: [], metrics: {}, properties: [{ name, development: name, developmentUrl: url, url, bedrooms: 5, price: null, plots: [], imageIds: [] }] } }] });
describe('Readable result routes', () => {
 it('uses builder and house names and keeps same-named builders separate', () => {
  const groups = [group('id1', 'bellway', 'The Sunningdale'), group('id2', 'cala', 'The Sunningdale')];
  expect([...groupRoutes('buildings', groups).values()]).toEqual(['/buildings/bellway/thesunningdale', '/buildings/cala/thesunningdale']);
 });
 it('uses readable location and interior names', () => {
  expect(groupRoutes('locations', [group('hash', 'persimmon', 'Abbot Walk')]).get('hash')).toBe('/locations/persimmon/abbotwalk');
  expect(groupRoutes('interiors', [group('hash', 'bellway', 'Study & Home Office')]).get('hash')).toBe('/interiors/studyhomeoffice');
  expect(routeSlug('Éden’s Place')).toBe('edensplace');
 });
 it('disambiguates same-builder location names consistently across crawl ordering', () => {
  const groups = [group('a', 'bellway', 'Same site', 'https://example.com/north'), group('b', 'bellway', 'Same site', 'https://example.com/south')];
  const routes = groupRoutes('locations', groups);
  expect(new Set(routes.values()).size).toBe(2);
  expect([...routes.values()].join(' ')).not.toContain('/a');
  expect(groupRoutes('locations', [...groups].reverse())).toEqual(routes);
 });
 it('encodes active filters without dropping spaces, ampersands or repeated values', () => {
  const path = withFilters('/buildings/bellway/thesunningdale', { bedrooms: '5', site: 'North & South', empty: '', q: ['desk', 'green'] });
  const url = new URL(path, 'https://local.test');
  expect(url.searchParams.get('site')).toBe('North & South');
  expect(url.searchParams.getAll('q')).toEqual(['desk', 'green']);
  expect(url.searchParams.has('empty')).toBe(false);
 });
});
