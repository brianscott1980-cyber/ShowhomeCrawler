import { describe, it, expect } from 'vitest';
import { developmentUrls, discoverHomes, galleryImages } from '../src/adapters/morris/site-parser.js';

describe('Morris Homes Adapter', () => {
  it('extracts development URLs from sitemap XML and excludes non-dev slugs', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://www.morrishomes.co.uk/development/</loc></url>
      <url><loc>https://www.morrishomes.co.uk/development/bartle-meadows/</loc></url>
      <url><loc>https://www.morrishomes.co.uk/development/bartle-meadows/windermere/</loc></url>
      <url><loc>https://www.morrishomes.co.uk/development/the-meadow/</loc></url>
      <url><loc>https://www.morrishomes.co.uk/development/davenham/</loc></url>
      <url><loc>https://www.morrishomes.co.uk/development/broadacre/</loc></url>
      <url><loc>https://www.morrishomes.co.uk/about-us/</loc></url>
    </urlset>`;
    const urls = developmentUrls(xml);
    expect(urls).toContain('https://www.morrishomes.co.uk/development/bartle-meadows/');
    expect(urls).toContain('https://www.morrishomes.co.uk/development/the-meadow/');
    expect(urls).not.toContain('https://www.morrishomes.co.uk/development/');
    expect(urls).not.toContain('https://www.morrishomes.co.uk/development/davenham/');
    expect(urls).not.toContain('https://www.morrishomes.co.uk/development/broadacre/');
    expect(urls).not.toContain('https://www.morrishomes.co.uk/about-us/');
  });

  it('discovers homes and coordinates from development HTML with embedded markers', () => {
    const html = `
    <h1>Bartle Meadows</h1>
    <script>
    var location = {lat: 53.784901, lng: -2.76902};
    var markers = [
      {"x":76.41,"y":58.58,"plotNumber":"436","childId":9730,"childTitle":"Bramley","featuredImage":"https://www.morrishomes.co.uk/wp-content/uploads/2026/09/4-BRAMLEY1-1.jpg","address":"Applewood Road, Cottam, Preston, PR4 0NB","bedrooms":"3","price":"£299,750","permalink":"https://www.morrishomes.co.uk/development/bartle-meadows/bramley/","plotColor":"#ab715e","status":"publish"},
      {"x":81.53,"y":60.66,"plotNumber":"437","childId":9729,"childTitle":"Poynton","featuredImage":"https://www.morrishomes.co.uk/wp-content/uploads/2026/09/5-POYNTON1.jpg","address":"Applewood Road, Cottam, Preston, PR4 0NB","bedrooms":"3","price":"£199,750","permalink":"https://www.morrishomes.co.uk/development/bartle-meadows/poynton/","plotColor":"#e1c79f","status":"publish"}
    ];
    </script>`;
    const res = discoverHomes(html, 'https://www.morrishomes.co.uk/development/bartle-meadows/');
    expect(res.development.name).toBe('Bartle Meadows');
    expect(res.development.latitude).toBeCloseTo(53.784901);
    expect(res.development.longitude).toBeCloseTo(-2.76902);
    expect(res.homes.length).toBe(2);
    expect(res.homes[0]?.plotNumber).toBe('436');
    expect(res.homes[0]?.name).toBe('Bramley · Plot 436');
    expect(res.homes[0]?.bedrooms).toBe(3);
    expect(res.homes[0]?.price).toBe(299750);
    expect(res.homes[0]?.url).toBe('https://www.morrishomes.co.uk/development/bartle-meadows/bramley/');
    expect(res.homes[0]?.available).toBe(true);
  });

  it('extracts gallery images while ignoring logos, icons, and badges', () => {
    const html = `
    <section class="single__property-header">
      <img src="https://www.morrishomes.co.uk/wp-content/uploads/2026/09/Scene-The-Windermere-plot-443_00000.jpg" alt="Windermere" />
      <img src="https://www.morrishomes.co.uk/wp-content/uploads/2026/09/CGE25108-A5-548.jpg" alt="Property gallery image 1" />
      <img src="https://www.morrishomes.co.uk/wp-content/uploads/2025/09/10_Year_Warranty.png" alt="10 Year Warranty" />
      <img src="https://www.morrishomes.co.uk/wp-content/uploads/2025/06/logo.webp" alt="Morris Homes" />
    </section>
    <div class="slider--fullwidth">
      <img src="https://www.morrishomes.co.uk/wp-content/uploads/2025/09/Bedroom-8-Davenham-Arkall-Farm-min.webp" alt="Property gallery image 3" />
    </div>`;
    const images = galleryImages(html);
    expect(images.length).toBe(3);
    expect(images[0]?.url).toBe('https://www.morrishomes.co.uk/wp-content/uploads/2026/09/Scene-The-Windermere-plot-443_00000.jpg');
    expect(images[0]?.altText).toBe('Windermere');
    expect(images[1]?.url).toBe('https://www.morrishomes.co.uk/wp-content/uploads/2026/09/CGE25108-A5-548.jpg');
    expect(images[2]?.url).toBe('https://www.morrishomes.co.uk/wp-content/uploads/2025/09/Bedroom-8-Davenham-Arkall-Farm-min.webp');
  });
});
