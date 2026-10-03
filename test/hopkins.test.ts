import { describe, it, expect } from 'vitest';
import { developmentUrls, enrichPage, discoverHomes, galleryImages } from '../src/adapters/hopkins/site-parser.js';

describe('Hopkins Homes Adapter', () => {
  it('extracts development URLs from sitemap XML', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://www.hopkinshomes.co.uk/developments/bournewood-park/</loc></url>
      <url><loc>https://www.hopkinshomes.co.uk/developments/suffolk/beccles/barsham-vale/</loc></url>
      <url><loc>https://www.hopkinshomes.co.uk/developments/house-styles/</loc></url>
    </urlset>`;

    const urls = developmentUrls(xml);
    expect(urls).toEqual([
      'https://www.hopkinshomes.co.uk/developments/bournewood-park/',
      'https://www.hopkinshomes.co.uk/developments/suffolk/beccles/barsham-vale/'
    ]);
  });

  it('discovers homes from plot cards', () => {
    const html = `
    <html>
      <head><title>Bournewood Park | Hopkins Homes</title></head>
      <body>
        <div class="plot-card">
          <a href="https://www.hopkinshomes.co.uk/developments/bournewood-park/the-ness-end-of-terrace-72/">
            <div class="plot-card-compact__title">72, The Ness - End of Terrace</div>
            <div>3 bed end-terrace</div>
            <div>£295,000</div>
          </a>
        </div>
      </body>
    </html>`;

    const res = discoverHomes(html, 'https://www.hopkinshomes.co.uk/developments/bournewood-park/');
    expect(res.development.name).toBe('Bournewood Park');
    expect(res.plots).toHaveLength(1);
    expect(res.plots[0]).toMatchObject({
      name: '72, The Ness - End of Terrace',
      url: 'https://www.hopkinshomes.co.uk/developments/bournewood-park/the-ness-end-of-terrace-72/',
      bedrooms: 3,
      price: 295000,
      isDetached: false,
      available: true,
    });
    expect(res.homes[1]?.propertyType).toBe('development');
  });

  it('enriches page with Google Maps destination coordinates', async () => {
    const html = `
    <html>
      <body>
        <a href="https://www.google.com/maps/dir/?api=1&destination=52.4451839,1.5611177">Directions</a>
        <div class="dev-contact-card__address">Beccles, Suffolk NR34 8UQ</div>
      </body>
    </html>`;

    const enriched = await enrichPage(html);
    expect(enriched).toContain('application/ld+json');
    expect(enriched).toContain('52.4451839');
    expect(enriched).toContain('1.5611177');
    expect(enriched).toContain('NR34 8UQ');
  });

  it('extracts gallery images from media paths', () => {
    const html = `
    <div class="gallery">
      <img src="https://www.hopkinshomes.co.uk/media/123/exterior.jpg?w=800" alt="Exterior view" />
      <img src="https://www.hopkinshomes.co.uk/media/logo.png" />
    </div>`;

    const images = galleryImages(html);
    expect(images).toHaveLength(1);
    expect(images[0]?.url).toBe('https://www.hopkinshomes.co.uk/media/123/exterior.jpg');
    expect(images[0]?.altText).toBe('Exterior view');
  });
});
