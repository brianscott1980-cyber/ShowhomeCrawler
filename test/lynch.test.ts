import { describe, expect, it } from 'vitest';
import { developmentUrls, discoverHomes, galleryImages } from '../src/adapters/lynch/site-parser';
import { matchesPropertyFilter } from '../src/filters/property-filter';
const url = 'https://www.lynchhomes.co.uk/jackton-manor-development/';
describe('Lynch Homes source extraction', () => {
 it('discovers development pages without including house types or the directory', () => {
  const xml = `<urlset>${[url, 'https://www.lynchhomes.co.uk/developments/', 'https://www.lynchhomes.co.uk/house-types/the-newark/', 'https://other.test/jackton-manor-development/'].map(u => `<url><loc>${u}</loc></url>`).join('')}</urlset>`;
  expect(developmentUrls(xml)).toEqual([url]);
 });
 it('retains advertised bedroom counts and plot details before applying five-bedroom criteria', () => {
  const html = `<title>Jackton Manor | Lynch Homes</title><div class="tmb"><h3><a href="/house-types/the-newark-plot-39/">The Newark Plot 39</a></h3><div class="t-entry-excerpt">Available - £480,000 · 4 Bedrooms</div></div>`;
  const result = discoverHomes(html, url);
  expect(result.homes[0]).toMatchObject({name:'The Newark',plotNumber:'39',bedrooms:4,price:480000});
  expect(result.homes.filter(p => matchesPropertyFilter(p, {minBedrooms:5}))).toHaveLength(0);
 });
 it('accepts explicit empty inventories and flags unsupported missing inventories', () => {
  expect(discoverHomes('<title>The Kings</title><div class="isotope-container">Nothing found.</div>', url).homes).toEqual([]);
  expect(() => discoverHomes('<title>The Kings</title><main>No cards</main>', url)).toThrow('No supported plot cards');
 });
 it('extracts property slider images without including unrelated images', () => {
  expect(galleryImages('<img data-guid="/wp-content/uploads/logo.webp"><div class="uncode-slider"><img data-guid="/wp-content/uploads/office.webp"></div>')).toEqual([{url:'https://www.lynchhomes.co.uk/wp-content/uploads/office.webp',position:0,altText:undefined}]);
 });
});
