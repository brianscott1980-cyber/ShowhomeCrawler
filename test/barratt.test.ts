import { describe, it, expect } from 'vitest';
import { developmentUrls, discoverHomes, galleryImages } from '../src/adapters/barratt/site-parser';
describe('Barratt public pages', () => {
 it('selects development URLs and excludes plot and location pages', () => {
  expect(developmentUrls('<urlset><url><loc>https://www.barratthomes.co.uk/new-homes/dev-002612-sterling-place/</loc></url><url><loc>https://www.barratthomes.co.uk/new-homes/dev002665-somer-meadows/plot-53-h880753/</loc></url></urlset>')).toEqual(['https://www.barratthomes.co.uk/new-homes/dev-002612-sterling-place/']);
 });
 it('extracts plot bedrooms and price from features, excluding incentive amounts', () => {
  const result = discoverHomes('<h1>Somer Meadows</h1><div class="plot-list"><div class="plot-list__plot"><a class="plot" href="plot-53-h880753/"><div class="plot__status-container">£22,000 DEPOSIT PAID</div><h3>Plot 53</h3><span class="plot__sales-name">Lamberton</span><ul class="plot__features"><li>5 bed house</li><li>From £549,995</li></ul></a></div></div>', 'https://www.barratthomes.co.uk/new-homes/dev002665-somer-meadows/');
  expect(result.homes[0]).toMatchObject({ name: 'Lamberton', bedrooms: 5, price: 549995, plotNumber: '53' });
 });
 it('reports plot cards without a details URL', () => {
  expect(discoverHomes('<h1>Church Fields</h1><div class="plot-list"><div class="plot-list__plot"><a class="plot" href="https://www.barratthomes.co.uk">Reserved</a></div></div>', 'https://www.barratthomes.co.uk/new-homes/dev002392-church-fields/').plotError).toContain('no details link');
 });
 it('uses the largest signed image and excludes unrelated page images', () => {
  expect(galleryImages('<div class="marketing-header--plot"><div class="carousel"><img src="/-/media/office.jpg?w=10" data-src="/-/media/office.jpg?w=375&amp;hash=small| /-/media/office.jpg?w=840&amp;hash=large" alt="Study"></div></div><img src="/-/media/unrelated.jpg">')).toEqual([{ url: 'https://www.barratthomes.co.uk/-/media/office.jpg?w=840&hash=large', position: 0, altText: 'Study' }]);
 });
});
