import { describe, it, expect } from 'vitest';
import { developmentUrls, discoverHomes, galleryImages } from '../src/adapters/keepmoat/site-parser.js';

describe('Keepmoat Adapter', () => {
  it('extracts development URLs from sitemap XML', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://www.keepmoat.com/willow-bank-stevenage/the-sarsgrove</loc></url>
      <url><loc>https://www.keepmoat.com/willow-bank-stevenage</loc></url>
      <url><loc>https://www.keepmoat.com/foxlow-fields-buxton</loc></url>
      <url><loc>https://www.keepmoat.com/careers/current-vacancies</loc></url>
      <url><loc>https://www.keepmoat.com/privacy-policy</loc></url>
    </urlset>`;
    const urls = developmentUrls(xml);
    expect(urls).toContain('https://www.keepmoat.com/willow-bank-stevenage');
    expect(urls).toContain('https://www.keepmoat.com/foxlow-fields-buxton');
    expect(urls).not.toContain('https://www.keepmoat.com/careers/current-vacancies');
    expect(urls).not.toContain('https://www.keepmoat.com/privacy-policy');
  });

  it('discovers homes from development HTML', () => {
    const html = `
    <h1>Willow Bank, Stevenage</h1>
    <section class="home-styles">
      <a href="/willow-bank-stevenage/the-sarsgrove" class="home-style">
        <div class="text">
          <h3>The Sarsgrove</h3>
          <span class="from">From £699,995</span>
          <p>4 bedroom homes</p>
          <p>Detached</p>
        </div>
      </a>
    </section>`;
    const res = discoverHomes(html, 'https://www.keepmoat.com/willow-bank-stevenage');
    expect(res.development.name).toBe('Willow Bank, Stevenage');
    expect(res.homes.length).toBe(1);
    expect(res.homes[0]?.name).toBe('The Sarsgrove');
    expect(res.homes[0]?.bedrooms).toBe(4);
    expect(res.homes[0]?.price).toBe(699995);
    expect(res.homes[0]?.isDetached).toBe(true);
    expect(res.homes[0]?.available).toBe(true);
  });

  it('extracts gallery images from home HTML', () => {
    const html = `
    <div class="img-slider">
      <div>
        <a href="/cdn-cgi/image/format=webp/getmedia/cf6da3fc-dab2-4172-8306-9e8ad684092c/WEB-Sarsgrove-Plot-1.jpg" data-fancybox="galleryA" class="fb-gallery">
          <img src="/cdn-cgi/image/format=webp/getmedia/cf6da3fc-dab2-4172-8306-9e8ad684092c/WEB-Sarsgrove-Plot-1.jpg" alt="Living room" />
        </a>
      </div>
      <div>
        <a href="/getmedia/b1b00938-0cf4-4b3a-af89-3f6a7078924b/BrickRed-ratings-logo-5-stars-600px.png" data-fancybox="galleryA">
          <img src="/getmedia/b1b00938-0cf4-4b3a-af89-3f6a7078924b/BrickRed-ratings-logo-5-stars-600px.png" alt="Ratings" />
        </a>
      </div>
    </div>`;
    const images = galleryImages(html);
    expect(images.length).toBe(1);
    expect(images[0]?.url).toBe('https://www.keepmoat.com/getmedia/cf6da3fc-dab2-4172-8306-9e8ad684092c/WEB-Sarsgrove-Plot-1.jpg');
    expect(images[0]?.altText).toBe('Living room');
  });
});
