import { describe, it, expect } from 'vitest';
import { developmentUrls, discoverHomes, galleryImages } from '../src/adapters/harron/site-parser.js';

describe('Harron Homes Adapter', () => {
  it('extracts development URLs from sitemap XML', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://www.harronhomes.com/find-a-home/</loc></url>
      <url><loc>https://www.harronhomes.com/find-a-home/south-yorkshire/riverdale-park/</loc></url>
      <url><loc>https://www.harronhomes.com/find-a-home/derbyshire/forge-green/</loc></url>
      <url><loc>https://www.harronhomes.com/about-us/</loc></url>
    </urlset>`;
    const urls = developmentUrls(xml);
    expect(urls).toContain('https://www.harronhomes.com/find-a-home/south-yorkshire/riverdale-park/');
    expect(urls).toContain('https://www.harronhomes.com/find-a-home/derbyshire/forge-green/');
    expect(urls).not.toContain('https://www.harronhomes.com/find-a-home/');
    expect(urls).not.toContain('https://www.harronhomes.com/about-us/');
  });

  it('discovers homes and coordinates from development HTML', () => {
    const html = `
    <title>New Build Homes For Sale Doncaster - Riverdale Park</title>
    <div class="acf-map">
      <div class="marker" data-lat="53.5431649" data-lng="-1.1094137"></div>
    </div>
    <div class="plot__card">
      <div class="plot__image-container">
        <a href="https://www.harronhomes.com/find-a-home/south-yorkshire/riverdale-park/riverdale-park-plot-74/">View</a>
      </div>
      <h3>Plot 74The Mawsley</h3>
      <p>3 Bedroom Detached Home</p>
      <p class="price">£290,000</p>
    </div>`;
    const res = discoverHomes(html, 'https://www.harronhomes.com/find-a-home/south-yorkshire/riverdale-park/');
    expect(res.development.name).toBe('Riverdale Park');
    expect(res.development.latitude).toBeCloseTo(53.5431649);
    expect(res.development.longitude).toBeCloseTo(-1.1094137);
    expect(res.homes.length).toBe(1);
    expect(res.homes[0]?.plotNumber).toBe('74');
    expect(res.homes[0]?.name).toBe('The Mawsley · Plot 74');
    expect(res.homes[0]?.bedrooms).toBe(3);
    expect(res.homes[0]?.price).toBe(290000);
    expect(res.homes[0]?.isDetached).toBe(true);
    expect(res.homes[0]?.available).toBe(true);
  });

  it('extracts gallery images while ignoring logos, maps, and floorplans', () => {
    const html = `
    <div class="title-bar">
      <img src="https://media.harronhomes.com/wp-content/uploads/2020/06/harron_logo-01.svg" alt="logo" />
    </div>
    <div class="gallery-slider">
      <div class="render-image">
        <img src="https://media.harronhomes.com/wp-content/uploads/2022/11/The-Mawsley-scaled.jpg" alt="The Mawsley" />
      </div>
      <div class="gallery-image">
        <img src="https://media.harronhomes.com/wp-content/uploads/2022/11/De-Maulay-Manor-The-Mawsley-DSC03515.jpg" alt="Living room" />
      </div>
      <div class="gallery-image">
        <img src="https://media.harronhomes.com/wp-content/uploads/2022/03/LocalArea_WebsiteGraphics.jpg" alt="Local Area" />
      </div>
    </div>
    <div class="reveal-inner">
      <img src="https://media.harronhomes.com/wp-content/uploads/2022/11/MAWSLEY-floorplan.jpg" alt="Floorplan" />
    </div>`;
    const images = galleryImages(html);
    expect(images.length).toBe(2);
    expect(images[0]?.url).toBe('https://media.harronhomes.com/wp-content/uploads/2022/11/The-Mawsley-scaled.jpg');
    expect(images[1]?.url).toBe('https://media.harronhomes.com/wp-content/uploads/2022/11/De-Maulay-Manor-The-Mawsley-DSC03515.jpg');
  });
});
