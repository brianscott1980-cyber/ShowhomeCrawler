import { describe, it, expect } from 'vitest';
import { developmentUrls, enrichPage, discoverHomes, galleryImages } from '../src/adapters/wain/site-parser.js';

describe('Wain Homes Adapter', () => {
  it('extracts development URLs from sitemap XML and filters non-developments', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://www.wainhomes.co.uk/find-your-home/</loc></url>
      <url><loc>https://www.wainhomes.co.uk/find-your-home/north-west/chorley/farriers-chase/</loc></url>
      <url><loc>https://www.wainhomes.co.uk/find-your-home/south-west/devon/oakdene/</loc></url>
      <url><loc>https://www.wainhomes.co.uk/about-us/</loc></url>
    </urlset>`;

    const urls = developmentUrls(xml);
    expect(urls).toContain('https://www.wainhomes.co.uk/find-your-home/north-west/chorley/farriers-chase/');
    expect(urls).toContain('https://www.wainhomes.co.uk/find-your-home/south-west/devon/oakdene/');
    expect(urls).not.toContain('https://www.wainhomes.co.uk/find-your-home/');
    expect(urls).not.toContain('https://www.wainhomes.co.uk/about-us/');
  });

  it('discovers homes from cards with bedroom count, price and detached status', () => {
    const html = `
    <title>Farriers Chase, Chorley | Wain Homes</title>
    <h1>Farriers Chase</h1>
    <div class="development-plot-header__address">Parkhurst Avenue, Chorley, PR25 5PF</div>
    <div class="development-homes-card">
      <div class="development-homes-card__image-container">
        <a href="https://www.wainhomes.co.uk/find-your-home/north-west/chorley/farriers-chase/fc-plot-53/">
          <img src="https://www.wainhomes.co.uk/wp-content/uploads/2026/09/The-Highstone.jpg" />
        </a>
      </div>
      <div class="development-homes-card__title-container">
        <a href="https://www.wainhomes.co.uk/find-your-home/north-west/chorley/farriers-chase/fc-plot-53/">
          <h3 class="development-homes-card__title">Plot 53</h3>
        </a>
      </div>
      <div class="development-homes-card__location-housetype">The Highstone</div>
      <div class="development-homes-card__details">
        <p class="development-homes-card__detail">Detached</p>
        <p class="development-homes-card__detail">4</p>
        <p class="development-homes-card__detail">3</p>
      </div>
      <div class="development-homes-card__price">£434,950</div>
    </div>
    <div class="development-homes-card">
      <div class="development-homes-card__title-container">
        <a href="https://www.wainhomes.co.uk/find-your-home/north-west/chorley/farriers-chase/fc-plot-6/">
          <h3 class="development-homes-card__title">Plot 6</h3>
        </a>
      </div>
      <div class="development-homes-card__location-housetype">The Standish</div>
      <div class="development-homes-card__details">
        <p class="development-homes-card__detail">Semi-detached</p>
        <p class="development-homes-card__detail">3</p>
      </div>
      <div class="development-homes-card__price">£350,000</div>
    </div>
    `;

    const res = discoverHomes(html, 'https://www.wainhomes.co.uk/find-your-home/north-west/chorley/farriers-chase/');
    expect(res.development.name).toBe('Farriers Chase');
    expect(res.plots.length).toBe(2);
    expect(res.plots[0]).toMatchObject({
      name: 'The Highstone (Plot 53)',
      bedrooms: 4,
      price: 434950,
      isDetached: true,
      available: true,
      status: 'advertised',
    });
    expect(res.plots[1]).toMatchObject({
      name: 'The Standish (Plot 6)',
      bedrooms: 3,
      price: 350000,
      isDetached: false,
    });
    expect(res.homes[2]?.propertyType).toBe('development');
  });

  it('extracts gallery images excluding badges and logos', () => {
    const html = `
    <header>
      <img src="https://www.wainhomes.co.uk/wp-content/themes/wain-homes/assets/images/logo.svg" alt="logo" />
      <img src="https://www.wainhomes.co.uk/wp-content/uploads/2024/09/New_Homes_Quality_Code_Logo.png" alt="NHQC" />
    </header>
    <div class="gallery">
      <a href="https://www.wainhomes.co.uk/wp-content/uploads/2025/10/Highstone_Farriers_Chase_CGI_HR.jpg">
        <img src="https://www.wainhomes.co.uk/wp-content/uploads/2025/10/Highstone_Farriers_Chase_CGI_HR-300x225.jpg" />
      </a>
      <img src="https://www.wainhomes.co.uk/wp-content/uploads/2026/09/The-Highstone-WH-Paddocks-51-768x512.jpg" srcset="https://www.wainhomes.co.uk/wp-content/uploads/2026/09/The-Highstone-WH-Paddocks-51-768x512.jpg 768w, https://www.wainhomes.co.uk/wp-content/uploads/2026/09/The-Highstone-WH-Paddocks-51.jpg 1600w" alt="Showhome living room" />
    </div>
    `;

    const images = galleryImages(html);
    expect(images.length).toBe(2);
    expect(images[0]?.url).toBe('https://www.wainhomes.co.uk/wp-content/uploads/2025/10/Highstone_Farriers_Chase_CGI_HR.jpg');
    expect(images[1]?.url).toBe('https://www.wainhomes.co.uk/wp-content/uploads/2026/09/The-Highstone-WH-Paddocks-51.jpg');
    expect(images[1]?.altText).toBe('Showhome living room');
  });

  it('enriches page with geo coordinates when postcode is found', async () => {
    const html = `
    <div class="development-plot-header__address">Parkhurst Avenue, Chorley, PR25 5PF</div>
    `;

    const enriched = await enrichPage(html);
    expect(enriched).toContain('application/ld+json');
    expect(enriched).toContain('GeoCoordinates');
  });
});
