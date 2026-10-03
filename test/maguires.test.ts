import { describe, it, expect } from 'vitest';
import { developmentUrls, enrichPage, discoverHomes, galleryImages } from '../src/adapters/maguires/site-parser.js';

describe('Maguires Developments Adapter', () => {
  it('extracts all core park developments', () => {
    const urls = developmentUrls('');
    expect(urls).toContain('https://www.m-d.co.uk/park/grovelands-park/');
    expect(urls).toContain('https://www.m-d.co.uk/park/tavern-park/');
    expect(urls).toContain('https://www.m-d.co.uk/park/ithon-valley-park/');
    expect(urls).toHaveLength(5);
  });

  it('discovers homes matching the specific park', () => {
    const html = `
    <h1>Grovelands Park</h1>
    <div id="crawler-park-homes">
      <article>
        <h2><a href="https://www.m-d.co.uk/park-home/6-pendine-grovelands-park/">6 Pendine, Grovelands Park</a></h2>
      </article>
      <article>
        <h2><a href="https://www.m-d.co.uk/park-home/91a-tavern-park/">91a Tavern Park</a></h2>
      </article>
    </div>
    `;

    const res = discoverHomes(html, 'https://www.m-d.co.uk/park/grovelands-park/');
    expect(res.development.name).toBe('Grovelands Park');
    expect(res.plots).toHaveLength(1);
    expect(res.plots[0]).toMatchObject({
      name: '6 Pendine, Grovelands Park',
      bedrooms: 2,
      price: 135000,
      propertyType: 'lodge',
      available: true,
    });
    expect(res.homes[1]?.propertyType).toBe('development');
  });

  it('extracts gallery images excluding logos', () => {
    const html = `
    <header>
      <img src="https://www.m-d.co.uk/wp-content/uploads/2020/07/logo-default.png" />
    </header>
    <div class="gallery">
      <img src="https://www.m-d.co.uk/wp-content/uploads/2025/07/CAM02180G0-PR0027-STILL001-300x200.jpg" alt="Living room" />
      <a href="https://www.m-d.co.uk/wp-content/uploads/2025/07/CAM02180G0-PR0027-STILL002.jpg">View full photo</a>
    </div>
    `;

    const images = galleryImages(html);
    expect(images).toHaveLength(2);
    expect(images[0]?.url).toBe('https://www.m-d.co.uk/wp-content/uploads/2025/07/CAM02180G0-PR0027-STILL001.jpg');
    expect(images[1]?.url).toBe('https://www.m-d.co.uk/wp-content/uploads/2025/07/CAM02180G0-PR0027-STILL002.jpg');
  });

  it('enriches page with geo coordinates when postcode is found', async () => {
    const html = `
    <div>Llangynin, Saint Clears, Carmarthen SA33 4AZ, UK</div>
    `;

    const enriched = await enrichPage(html, async () => '<article></article>');
    expect(enriched).toContain('application/ld+json');
    expect(enriched).toContain('GeoCoordinates');
  });
});
