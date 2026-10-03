import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { galleryImages, developmentUrls, discoverHomes } from '../src/adapters/bellway/site-parser.js';
import { imageIdentity, sameVisual, sha256 } from '../src/galleries/image-hasher.js';
import { RequestClient, mapLimit, RequestError } from '../src/crawler/request-client.js';
import { verdictSchema, validateBatch } from '../src/vision/gemini-classifier.js';
it('decodes the observed gallery without executing expressions', async () => {
 const images = galleryImages(await readFile('test/fixtures/bellway/gallery.html', 'utf8'));
 expect(images).toHaveLength(20); expect(images[0]!.position).toBe(0);
 expect(images[0]!.url).toContain('/_large/378704/60617-sunningdale.webp');
 expect(images[19]!.position).toBe(19);
});
it('limits sitemap discovery to canonical development URLs and deduplicates', () => {
 const url = 'https://www.bellway.co.uk/new-homes/region/site';
 expect(developmentUrls(`<urlset><url><loc>${url}</loc></url><url><loc>${url}/</loc></url><url><loc>${url}/house</loc></url><url><loc>https://other.test/new-homes/r/s</loc></url></urlset>`)).toEqual([url]);
});
it('retains advertised five-bedroom styles even when plot data is missing', () => {
 const data = discoverHomes('<h1>Sample</h1><div class="text-container"><a href="/new-homes/region/site/the-home-5-bedroom-semi-detached"><span class="result-title">The Home</span></a><span class="result-description">5 bedroom semi-detached home</span><span class="result-pricing">From £500,000</span></div>', 'https://www.bellway.co.uk/new-homes/region/site');
 expect(data.homes[0]).toMatchObject({ bedrooms: 5, isDetached: false, price: 500000 }); expect(data.plotError).not.toBeNull();
});
it('recognises a resized and recompressed photo but rejects a different image', async () => {
 const pixels = Buffer.alloc(128 * 96 * 3);
 for (let y = 0; y < 96; y++) for (let x = 0; x < 128; x++) { const i = (y * 128 + x) * 3; pixels[i] = (x * 2 + y) % 256; pixels[i + 1] = y * 2; pixels[i + 2] = x; }
 const photo = await sharp(pixels, { raw: { width: 128, height: 96, channels: 3 } }).png().toBuffer();
 const recompressed = await sharp(photo).resize(64, 48).jpeg({ quality: 85 }).toBuffer();
 const other = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#ff00ff' } }).png().toBuffer();
 const a = await imageIdentity(photo), b = await imageIdentity(recompressed), c = await imageIdentity(other);
 expect(sha256(photo)).not.toBe(sha256(recompressed)); expect(sameVisual(a, b)).toBe(true); expect(sameVisual(a, c)).toBe(false);
});
it('bounds concurrent queue work and preserves order', async () => {
 let active = 0, maximum = 0;
 const result = await mapLimit([1,2,3,4,5], 2, async n => { active++; maximum = Math.max(maximum, active); await new Promise(r => setTimeout(r, 5)); active--; return n * 2; });
 expect(maximum).toBe(2); expect(result).toEqual([2,4,6,8,10]);
});
it('does not retry permanent HTTP errors', async () => {
 let calls = 0;
 const client = new RequestClient({ delay: 0, retries: 3, timeout: 1000, maxRequests: 5 }, (async () => { calls++; return new Response('missing', { status: 404 }); }) as typeof fetch);
 await expect(client.text('https://www.bellway.co.uk/example')).rejects.toBeInstanceOf(RequestError); expect(calls).toBe(1);
});
it('rejects oversized responses and disallowed hosts', async () => {
 const client = new RequestClient({ delay: 0, retries: 0, timeout: 1000, maxRequests: 5 }, (async () => new Response('too large')) as typeof fetch);
 await expect(client.bytes('https://www.bellway.co.uk/example', 2)).rejects.toThrow('Response exceeds byte limit');
 await expect(client.bytes('https://unrelated.test/example')).rejects.toThrow('allowlist');
});
it('does not coerce classifier strings to booleans', () => {
 expect(() => verdictSchema.parse({ matches: 'false', hasDesk: false, hasBed: false, roomType: 'bedroom', description: '', reason: '' })).toThrow();
});

it('requires every batch image ID exactly once and rejects contradictory matches', () => {
 const verdict = { matches: false, hasDesk: false, hasBed: true, hasFloorplan: false, roomType: 'bedroom', description: '', reason: '' };
 expect(validateBatch({ images: [{ ...verdict, imageId: 'a' }] }, ['a'])[0]!.id).toBe('a');
 expect(() => validateBatch({ images: [{ ...verdict, imageId: 'b' }] }, ['a'])).toThrow();
 expect(() => validateBatch({ images: [{ ...verdict, imageId: 'a' }, { ...verdict, imageId: 'a' }] }, ['a', 'b'])).toThrow();
 expect(() => validateBatch({ images: [{ ...verdict, matches: true, hasDesk: true, imageId: 'a' }] }, ['a'])).toThrow('Contradictory');
});
it('follows only same-origin redirects and avoids restricted search routes', async () => {
 let calls = 0;
 const client = new RequestClient({ delay: 0, retries: 0, timeout: 1000, maxRequests: 5 }, (async () => {
  calls++; return calls === 1 ? new Response(null, { status: 301, headers: { location: '/new-homes/region/canonical' } }) : new Response('canonical');
 }) as typeof fetch);
 expect(await client.text('https://www.bellway.co.uk/new-homes/region/old')).toBe('canonical');
 const denied = new RequestClient({ delay: 0, retries: 0, timeout: 1000, maxRequests: 5 }, (async () => new Response(null, { status: 301, headers: { location: '/new-homes/results' } })) as typeof fetch);
 await expect(denied.text('https://www.bellway.co.uk/example')).rejects.toThrow('Redirect outside allowed source');
});
it('exports positive and negative decisions with safe review markup', async () => {
 const { mkdtemp, rm } = await import('node:fs/promises');
 const { tmpdir } = await import('node:os');
 const { writeReport } = await import('../src/reports/report.js');
 const folder = await mkdtemp(tmpdir() + '/showhome-report-');
 try {
  const report = { status: 'completed', startedAt: '2026-10-02', model: 'test-model', question: 'Home office with no beds', developments: [{ url: 'https://www.bellway.co.uk/new-homes/r/s', name: 'Site', status: 'complete' }], properties: [{ development: 'Site<script>', developmentUrl: 'https://www.bellway.co.uk/new-homes/r/s', name: 'House', url: 'https://www.bellway.co.uk/new-homes/r/s/h', bedrooms: 5, price: null, plots: [], imageIds: ['a', 'b'] }], images: [
   { id: 'a', path: 'images/a.jpg', sourceUrl: 'https://cms.bellway.co.uk/a.jpg', verdict: { matches: true, hasDesk: true, hasBed: false, roomType: 'office', description: 'Office', reason: 'Desk; no bed' } },
   { id: 'b', path: 'images/b.jpg', sourceUrl: 'https://cms.bellway.co.uk/b.jpg', verdict: { matches: false, hasDesk: true, hasBed: true, roomType: 'bedroom', description: 'Bedroom', reason: 'Bed visible' } }
  ], errors: [], metrics: {} };
  await writeReport(folder, report);
  const html = await readFile(folder + '/full-report.html', 'utf8');
  expect(html).toContain('Site&lt;script&gt;'); expect(html).not.toContain('Site<script>');
  expect(html).toContain('NO MATCH'); expect(html).toContain('Bed visible');
  const matches = await readFile(folder + '/matches.csv', 'utf8'); expect(matches).toContain('images/a.jpg'); expect(matches).not.toContain('images/b.jpg');
 } finally { await rm(folder, { recursive: true }); }
});
it('filters minimum bedrooms without imposing detached or price criteria', async () => {
 const { matchesPropertyFilter } = await import('../src/filters/property-filter.js');
 const property = { externalId:'p', name:'Home', url:'https://example.test/p', bedrooms:5, price:null, propertyType:'semi-detached', isDetached:false, available:true };
 expect(matchesPropertyFilter(property,{minBedrooms:5})).toBe(true);
 expect(matchesPropertyFilter({...property,bedrooms:4},{minBedrooms:5})).toBe(false);
 expect(matchesPropertyFilter({...property,bedrooms:null},{minBedrooms:5})).toBe(false);
 expect(matchesPropertyFilter(property,{minPrice:400000})).toBe(false);
 expect(matchesPropertyFilter(property,{detachedOnly:true})).toBe(false);
});

it('rejects floorplans even when desks are drawn and requires the floorplan flag',()=>{const verdict={imageId:'a',matches:true,hasDesk:true,hasBed:false,hasFloorplan:true,roomType:'office',description:'Drawn desk',reason:'Desk drawn'};expect(()=>validateBatch({images:[verdict]},['a'])).toThrow('Contradictory');expect(()=>validateBatch({images:[{...verdict,hasFloorplan:false,roomType:'floor plan'}]},['a'])).toThrow('Contradictory');const {hasFloorplan,...missing}=verdict;expect(()=>validateBatch({images:[missing]},['a'])).toThrow();expect(validateBatch({images:[{...verdict,matches:false}]},['a'])[0]?.verdict.matches).toBe(false);});

it('accepts an explicitly empty Bellway carousel without executing expressions',()=>{expect(galleryImages('<div x-data="multiImageCarousel({ images: [] })"></div>')).toEqual([]);expect(()=>galleryImages('<div x-data="multiImageCarousel({ images: dangerous() })"></div>')).toThrow('Unknown Bellway gallery encoding');});

it('retains named Bellway house-style cards whose bedroom metadata is missing',()=>{const r=discoverHomes('<h1>New site</h1><div class="text-container"><h3 class="result-title">The New Home</h3><a href="/new-homes/division/new-site/the-new-home">Details</a></div>','https://www.bellway.co.uk/new-homes/division/new-site');expect(r.homes[0]).toMatchObject({name:'The New Home',bedrooms:null,url:'https://www.bellway.co.uk/new-homes/division/new-site/the-new-home'});});
