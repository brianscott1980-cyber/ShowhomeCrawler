import { describe, it, expect } from 'vitest';
import { developmentUrls, enrichPage, discoverHomes, galleryImages } from '../src/adapters/anwyl/site-parser.js';

describe('Anwyl Homes Adapter', () => {
  it('extracts development URLs from sitemap XML and excludes root', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://www.anwylhomes.co.uk/our-developments/</loc></url>
      <url><loc>https://www.anwylhomes.co.uk/our-developments/deva-green/</loc></url>
      <url><loc>https://www.anwylhomes.co.uk/our-developments/summers-bridge/</loc></url>
      <url><loc>https://www.anwylhomes.co.uk/our-developments/%development_name%/</loc></url>
      <url><loc>https://www.anwylhomes.co.uk/about-us/</loc></url>
    </urlset>`;
    const urls = developmentUrls(xml);
    expect(urls).toContain('https://www.anwylhomes.co.uk/our-developments/deva-green/');
    expect(urls).toContain('https://www.anwylhomes.co.uk/our-developments/summers-bridge/');
    expect(urls).not.toContain('https://www.anwylhomes.co.uk/our-developments/');
    expect(urls).not.toContain('https://www.anwylhomes.co.uk/our-developments/%development_name%/');
    expect(urls).not.toContain('https://www.anwylhomes.co.uk/about-us/');
  });

  it('enriches page and discovers homes with coordinates and bedrooms', async () => {
    const html = `
    <title>Deva Green | New Builds in Chester | Anwyl Homes</title>
    <div id="anwyl-location-map" data-lat="53.196525" data-lng="-2.921485"></div>
    <div class="wp-block-rf-origin-house-types anwyl-house-page-list" data-development-id="905"></div>
    `;

    const mockApiResponse = JSON.stringify([
      {
        id: '906',
        name: 'ascot',
        description: '4 bedroom Detached',
        permalink: 'https://www.anwylhomes.co.uk/our-developments/deva-green/ascot/',
        num_bedrooms: { id: 7, name: '4' },
        from_price: '419995',
        dwelling_type: 'Detached',
        availability: 'Available'
      },
      {
        id: '931',
        name: 'bunbury',
        description: '3 bedroom Semi-Detached',
        permalink: 'https://www.anwylhomes.co.uk/our-developments/deva-green/bunbury/',
        num_bedrooms: { id: 8, name: '3' },
        from_price: '315000',
        dwelling_type: 'Semi-Detached',
        availability: 'Sold'
      }
    ]);

    const enriched = await enrichPage(html, async url => {
      expect(url).toContain('/wp-json/anwyl/v1/house-types?development=905');
      return mockApiResponse;
    });

    const res = discoverHomes(enriched, 'https://www.anwylhomes.co.uk/our-developments/deva-green/');
    expect(res.development.name).toBe('Deva Green');
    expect(res.development.latitude).toBeCloseTo(53.196525);
    expect(res.development.longitude).toBeCloseTo(-2.921485);
    expect(res.homes.length).toBe(2);

    expect(res.homes[0]?.name).toBe('The Ascot');
    expect(res.homes[0]?.url).toBe('https://www.anwylhomes.co.uk/our-developments/deva-green/ascot/');
    expect(res.homes[0]?.bedrooms).toBe(4);
    expect(res.homes[0]?.price).toBe(419995);
    expect(res.homes[0]?.isDetached).toBe(true);
    expect(res.homes[0]?.available).toBe(true);

    expect(res.homes[1]?.name).toBe('The Bunbury');
    expect(res.homes[1]?.bedrooms).toBe(3);
    expect(res.homes[1]?.isDetached).toBe(false);
    expect(res.homes[1]?.available).toBe(false);
    expect(res.homes[1]?.status).toBe('sold');
  });

  it('extracts gallery images from data-imageset while ignoring video and badges', () => {
    const html = `
    <header>
      <img src="https://www.anwylhomes.co.uk/app/themes/anwyl-homes/dist/images/Anwyl_95th_anniversary_logo.png" alt="logo" />
    </header>
    <div class="wp-block-rf-origin-featured-gallery gallery-container" data-imageset='[
      {"id":6884,"url":"https://www.anwylhomes.co.uk/app/uploads/2023/11/7170.jpg","type":"image","title":"Living Room"},
      {"id":6467,"url":"https://www.anwylhomes.co.uk/app/uploads/2024/01/Plot_001_Ascot_Grand_Front.jpg","type":"image","title":"Ascot Front"},
      {"id":9999,"url":"https://www.youtube.com/watch?v=12345","type":"video","title":"Virtual Tour"},
      {"id":8888,"url":"https://www.anwylhomes.co.uk/app/uploads/2023/11/nhqc-logo.webp","type":"image","title":"NHQC"}
    ]'>
    </div>`;

    const images = galleryImages(html);
    expect(images.length).toBe(2);
    expect(images[0]?.url).toBe('https://www.anwylhomes.co.uk/app/uploads/2023/11/7170.jpg');
    expect(images[0]?.altText).toBe('Living Room');
    expect(images[1]?.url).toBe('https://www.anwylhomes.co.uk/app/uploads/2024/01/Plot_001_Ascot_Grand_Front.jpg');
  });
});
