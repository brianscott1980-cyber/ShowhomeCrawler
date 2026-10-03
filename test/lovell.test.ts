import { describe, expect, it } from 'vitest';
import { developmentUrls, discoverHomes, enrichPage, galleryImages } from '../src/adapters/lovell/site-parser.js';

describe('Lovell public gallery discovery', () => {
  it('distinguishes developments from house types and includes smaller homes', () => {
    expect(developmentUrls('<urlset><url><loc>https://newhomes.lovell.co.uk/development/one/</loc></url><url><loc>https://newhomes.lovell.co.uk/development/one/home/</loc></url></urlset>')).toEqual(['https://newhomes.lovell.co.uk/development/one/']);
    const result = discoverHomes('<h1>One <span>Town</span></h1><div class="card"><a data-house-type="Apartment" href="/development/one/apartment/">Apartment</a><p>2 bedroom homes £150,000</p></div>', 'https://newhomes.lovell.co.uk/development/one/');
    expect(result.development.name).toBe('One');
    expect(result.homes[0]).toMatchObject({ name: 'Apartment', bedrooms: 2, price: 150000 });
    expect(result.homes[1]?.name).toBe('One development gallery');
  });

  it('retains uncropped photos and floorplans, deduplicating responsive variants', () => {
    const html = '<div class="dev-carousel"><picture><source srcset="/media/a/kitchen.jpg?width=1400&amp;mode=crop"><img alt="Kitchen"></picture><img src="/media/a/kitchen.jpg?width=480"><img src="/images/development/trustpilot-review.svg"></div><div class="card-deck-slider"><img class="img-fluid" data-srcset="/media/b/floor.jpg?width=400" alt="Ground Floor"></div><img src="/media/c/news.jpg">';
    expect(galleryImages(html).map(image => image.url)).toEqual(['https://newhomes.lovell.co.uk/media/a/kitchen.jpg?rmode=max&width=2048', 'https://newhomes.lovell.co.uk/media/b/floor.jpg?rmode=max&width=2048']);
    expect(() => galleryImages('<div class="dev-carousel"><img src="https://other.example/photo.jpg"></div>')).toThrow('Unexpected gallery image origin');
  });

  it('preserves the builder-provided location before transient scripts are removed', async () => {
    const data = { address: { coordinates: { lat: 55.77, lng: -4.06 }, postalcode: 'ML3 9BZ', state: 'Scotland', country: 'United Kingdom' } };
    expect(await enrichPage(`<body><div data-development-json='${JSON.stringify(data)}'></div></body>`)).toContain('"latitude":55.77');
  });
});
