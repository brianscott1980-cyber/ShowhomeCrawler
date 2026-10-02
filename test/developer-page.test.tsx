import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
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
 ...await importOriginal<typeof import('../src/web/collections')>(), readCollection: vi.fn(async () => report),
}));
vi.mock('../src/web/groups', () => ({ readGroups: vi.fn(async () => [{ key: 'abbot', name: 'Abbot Walk', developers: ['Avant'], count: 2, collections: [{ slug: 'avant', name: 'Avant', report }] }]) }));
import Page, { generateMetadata } from '../src/app/developers/[slug]/page';
import { groupMetadata, GroupDetail } from '../src/web/group-pages';
import Favourites from '../src/app/favourites/page';
import { readCollection } from '../src/web/collections';
import { Navigation } from '../src/web/navigation';
const props = { params: Promise.resolve({ slug: 'avant' }) };

describe('Shared results template', () => {
 it('uses the developer template on each directory destination and favourites', async () => {
  for (const page of [await Page(props), ...await Promise.all(['locations', 'interiors', 'buildings'].map(kind => GroupDetail({ kind: kind as 'locations', id: kind==='interiors'?'abbotwalk':'avant/abbotwalk' }))), await Favourites()]) {
   const dom = new JSDOM(renderToStaticMarkup(page));
   try {
    const doc = dom.window.document;
    expect(doc.querySelector('.results-page')).not.toBeNull();
    expect(doc.querySelector('.results-hero h1')).not.toBeNull();
    expect(doc.querySelector('[aria-label="Image card layout"]')).not.toBeNull();
    expect(doc.querySelector('.results-viewer')).not.toBeNull();
    expect(doc.querySelector('.filters')!.compareDocumentPosition(doc.querySelector('.results-hero')!) & dom.window.Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(doc.querySelectorAll('.results-hero')).toHaveLength(1);
   } finally { dom.window.close(); }
  }
 });
 it('redirects old group IDs while preserving filters and uses readable canonical links', async () => {
  try { await GroupDetail({kind:'locations',id:'abbot',searchParams:{q:'desk',site:'North & South'}}); throw new Error('Expected redirect'); }
  catch(error) { expect((error as {digest:string}).digest).toContain('/locations/avant/abbotwalk?q=desk&site=North+%26+South'); }
  expect((await groupMetadata('locations','avant/abbotwalk')).alternates.canonical).toBe('/locations/avant/abbotwalk');
 });
 it('preserves builder metadata and image URLs', async () => {
  const metadata = await generateMetadata(props);
  expect(metadata.alternates?.canonical).toBe('/developers/avant');
  const dom = new JSDOM(renderToStaticMarkup(await Page(props)));
  expect(dom.window.document.querySelector('.photo-button img')?.getAttribute('src')).toBe('/api/assets/avant/images/one.jpg');
  expect(dom.window.document.querySelector('.download-links a')?.getAttribute('href')).toBe('/api/assets/avant/matches.csv');
  dom.window.close();
 });
 it('supports layouts, fullscreen keyboard navigation, thumbnails and favourites in the common header', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://local.test' });
  for (const [name, value] of Object.entries({ Event: dom.window.Event, window: dom.window, self: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) vi.stubGlobal(name, value);
  dom.window.matchMedia = (() => ({ matches: true })) as never;
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new dom.window.Event('close')); };
  const root = createRoot(document.getElementById('root')!);
  try {
   await act(async () => root.render(<><Navigation/>{await Page(props)}</>));
   await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Smaller grid"]')!.click());
   expect(document.querySelector('.image-grid-compact')).not.toBeNull();
   await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="List"]')!.click());
   expect(document.querySelector('.image-grid-list')).not.toBeNull();
   const opener = document.querySelector<HTMLButtonElement>('.photo-button')!;
   opener.focus();
   await act(async () => opener.click());
   const viewer = document.querySelector<HTMLDialogElement>('.results-viewer')!;
   expect(viewer.open).toBe(true);
   expect(document.body.style.overflow).toBe('hidden');
   await act(async () => viewer.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
   expect(viewer.querySelector('.results-full-image')?.getAttribute('src')).toContain('/two.jpg');
   await act(async () => viewer.querySelector<HTMLButtonElement>('[aria-label="View image 1"]')!.click());
   expect(viewer.querySelector('.results-full-image')?.getAttribute('src')).toContain('/one.jpg');
   await act(async () => viewer.querySelector<HTMLButtonElement>('[aria-label="Add to favourites"]')!.click());
   expect(JSON.parse(localStorage.getItem('showhome-favourites-v1')!)).toEqual(['one']);
   expect(document.querySelector('.favourites-count')?.textContent).toBe('1');
   await act(async () => viewer.querySelector<HTMLButtonElement>('[aria-label="Close image"]')!.click());
   expect(viewer.open).toBe(false);
   expect(document.body.style.overflow).toBe('');
   expect(document.activeElement).toBe(opener);
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); dom.window.close(); }
 });
 it('handles missing builders and unpublished collections', async () => {
  await expect(Page({ params: Promise.resolve({ slug: 'unknown' }) })).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  vi.mocked(readCollection).mockResolvedValueOnce(null);
  expect(renderToStaticMarkup(await Page(props))).toContain('coming soon');
 });
});
