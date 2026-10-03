import { describe, it, expect } from 'vitest';
import { developmentUrls, discoverHomes, galleryImages } from '../src/adapters/gleeson/site-parser.js';

describe('Gleeson Homes Adapter', () => {
  it('extracts development URLs from sitemap XML and excludes regions', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://gleesonhomes.co.uk/developments/all-saints/</loc></url>
      <url><loc>https://gleesonhomes.co.uk/developments/belmont-place/</loc></url>
      <url><loc>https://gleesonhomes.co.uk/developments/barnsley/</loc></url>
      <url><loc>https://gleesonhomes.co.uk/developments/cumbria/</loc></url>
      <url><loc>https://gleesonhomes.co.uk/find-your-home/</loc></url>
    </urlset>`;
    const urls = developmentUrls(xml);
    expect(urls).toContain('https://gleesonhomes.co.uk/developments/all-saints/');
    expect(urls).toContain('https://gleesonhomes.co.uk/developments/belmont-place/');
    expect(urls).not.toContain('https://gleesonhomes.co.uk/developments/barnsley/');
    expect(urls).not.toContain('https://gleesonhomes.co.uk/developments/cumbria/');
    expect(urls).not.toContain('https://gleesonhomes.co.uk/find-your-home/');
  });

  it('discovers homes from development HTML', () => {
    const html = `
    <h1>All Saints</h1>
    <div class="result-card">
      <a href="/developments/all-saints/074/" title="View Plot 74">
        <h3 class="result-card__heading">Plot 74 – Tyrone</h3>
      </a>
      <ul class="result-card__spec"><li>3 bedroom semi-detached home<li>Driveway</ul>
      <strong>Available for £131,960</strong>
    </div>`;
    const res = discoverHomes(html, 'https://gleesonhomes.co.uk/developments/all-saints/');
    expect(res.development.name).toBe('All Saints');
    expect(res.homes.length).toBe(1);
    expect(res.homes[0]?.plotNumber).toBe('74');
    expect(res.homes[0]?.name).toBe('Tyrone · Plot 74');
    expect(res.homes[0]?.bedrooms).toBe(3);
    expect(res.homes[0]?.price).toBe(131960);
    expect(res.homes[0]?.isDetached).toBe(false);
  });

  it('extracts gallery images from plot HTML', () => {
    const html = `
    <div class="media-carousel__carousel-item">
      <picture class="media-carousel__carousel-item-picture">
        <source srcset="/site/assets/files/334098/74_all_saints.1200x800.webp">
        <img src="/site/assets/files/334098/74_all_saints.600x340.webp" alt="Living room" />
      </picture>
    </div>`;
    const images = galleryImages(html);
    expect(images.length).toBe(1);
    expect(images[0]?.url).toBe('https://gleesonhomes.co.uk/site/assets/files/334098/74_all_saints.1200x800.webp');
    expect(images[0]?.altText).toBe('Living room');
  });
});
