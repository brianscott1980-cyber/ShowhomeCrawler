import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import type { RunReport } from '../src/reports/report';

const report: RunReport = {
 status: 'completed', startedAt: 'now', model: 'test', question: 'test',
 developments: [], properties: [], errors: [], metrics: {},
 images: ['one', 'two'].map(id => ({ id, path: `images/${id}.jpg`, sourceUrl: 'https://example.com', verdict: {
  matches: true, hasDesk: true, hasBed: false, roomType: 'office', description: id, reason: 'Desk visible',
 } })),
};
vi.mock('../src/web/collections', async importOriginal => ({
 ...await importOriginal<typeof import('../src/web/collections')>(),
 readCollection: vi.fn(async () => report),
}));
import { GET } from '../src/app/developers/[slug]/route';

describe('Developer report pages', () => {
 it('serves the report carousel and favourites with working web URLs', async () => {
  const response = await GET(new Request('https://local.test/developers/cala'), { params: Promise.resolve({ slug: 'cala' }) });
  expect(response.headers.get('Content-Type')).toContain('text/html');
  const dom = new JSDOM(await response.text(), {
   url: 'https://local.test/developers/cala', runScripts: 'dangerously', pretendToBeVisual: true,
   beforeParse(window) { window.matchMedia = (() => ({ matches: true })) as never; },
  });
  try {
   const { document, localStorage } = dom.window;
   expect(document.querySelector('.explorer-brand')?.textContent).toBe('SHOWHOMEEXPLORER');
   expect(document.querySelector('.developer-name')?.textContent).toBe('Cala');
   expect(document.querySelector<HTMLAnchorElement>('.explorer-brand')?.pathname).toBe('/');
   expect(document.querySelector<HTMLAnchorElement>('[data-favourites-link="/favourites"]')?.pathname).toBe('/favourites');
   expect(document.querySelector<HTMLAnchorElement>('footer a')?.pathname).toBe('/api/assets/cala/matches.csv');
   expect(document.querySelector('header .nav-link')).toBeNull();
   expect(document.querySelector<HTMLAnchorElement>('.developer-name')?.href).toBe('https://www.cala.co.uk/');
   document.querySelector<HTMLButtonElement>('[data-step="1"]')!.click();
   expect(document.getElementById('hero-image')?.getAttribute('src')).toBe('/api/assets/cala/images/two.jpg');
   document.querySelector<HTMLButtonElement>('.card-save')!.click();
   expect(JSON.parse(localStorage.getItem('showhome-favourites-v1')!)).toEqual(['one']);
   expect(document.querySelector('.card-save')?.getAttribute('aria-pressed')).toBe('true');
   expect(document.querySelector('.site-header')).toBeNull();
  } finally { dom.window.close(); }
 });
 it('returns 404 for an unknown developer', async () => {
  expect((await GET(new Request('https://local.test/developers/unknown'), { params: Promise.resolve({ slug: 'unknown' }) })).status).toBe(404);
 });
});
