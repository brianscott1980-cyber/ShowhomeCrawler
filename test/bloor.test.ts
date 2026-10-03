import { describe, it, expect } from 'vitest';
import { developmentUrls, discoverHomes, galleryImages } from '../src/adapters/bloor/site-parser.js';

describe('Bloor Homes Adapter', () => {
  it('extracts development URLs from sitemap XML', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://bloorhomes.com/new-homes/warwickshire/atherstone/atherstone-place</loc></url>
      <url><loc>https://bloorhomes.com/new-homes/warwickshire/atherstone/atherstone-place/plot-197</loc></url>
      <url><loc>https://bloorhomes.com/new-homes/warwickshire/atherstone</loc></url>
      <url><loc>https://bloorhomes.com/buying-guide</loc></url>
    </urlset>`;
    const urls = developmentUrls(xml);
    expect(urls).toEqual(['https://bloorhomes.com/new-homes/warwickshire/atherstone/atherstone-place']);
  });

  it('discovers homes from development HTML', () => {
    const html = `
    <script>
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ "development": "Atherstone Place" });
    </script>
    <div class="HomeCard">
      <a href="/new-homes/warwickshire/atherstone/atherstone-place/plot-197">
        PLOT 197 | 3 bedrooms | Available The Drake £320,000
      </a>
    </div>`;
    const res = discoverHomes(html, 'https://bloorhomes.com/new-homes/warwickshire/atherstone/atherstone-place');
    expect(res.development.name).toBe('Atherstone Place');
    expect(res.plots.length).toBe(1);
    expect(res.plots[0]?.plotNumber).toBe('197');
    expect(res.plots[0]?.bedrooms).toBe(3);
    expect(res.plots[0]?.price).toBe(320000);
    expect(res.plots[0]?.available).toBe(true);
  });

  it('extracts gallery images from plot HTML', () => {
    const html = `
    <img src="https://res.cloudinary.com/bloor-homes-production/image/upload/c_fill,g_auto,w_324/f_auto/q_auto/v1/Dekker_Lounge1_A_zxdncs" alt="Living room with sofa" />
    <img src="https://res.cloudinary.com/bloor-homes-production/image/upload/c_fill,g_auto,w_324/f_auto/q_auto/v1/bed-dark_if2o4f" alt="Bed Icon" />
    `;
    const images = galleryImages(html);
    expect(images.length).toBe(1);
    expect(images[0]?.url).toContain('Dekker_Lounge1_A_zxdncs');
    expect(images[0]?.altText).toBe('Living room with sofa');
  });
});
