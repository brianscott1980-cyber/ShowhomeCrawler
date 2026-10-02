import { afterEach, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { GroupCards } from '../src/web/group-cards';
const cards = [{ key: 'internal-hash', href: '/buildings/bellway/thesunningdale', name: 'The Sunningdale', developers: ['Bellway'], count: 1, image: '/test.jpg', description: 'Interior', bedrooms: [5], sites: ['Abbot Walk'], locations: ['England'], places: [{ site: 'Abbot Walk', locations: ['England'] }] }];
afterEach(() => vi.unstubAllGlobals());
it('restores directory filters from a shared URL and carries them onto readable result links', async () => {
 const dom = new JSDOM('<div id="root"></div>', { url: 'https://local.test/buildings?developer=Bellway&bedrooms=5&site=Abbot+Walk' });
 for (const [name, value] of Object.entries({ window: dom.window, self: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) vi.stubGlobal(name, value);
 const root = createRoot(document.getElementById('root')!);
 try {
  await act(async () => root.render(<GroupCards cards={cards} pathPrefix="buildings" kindLabel="Buildings"/>));
  const selects = document.querySelectorAll<HTMLSelectElement>('.site-filters select');
  expect(selects[0]!.value).toBe('Bellway'); expect(selects[1]!.value).toBe('5'); expect(selects[3]!.value).toBe('Abbot Walk');
  const link = new URL(document.querySelector('a.collection-card')!.getAttribute('href')!, dom.window.location.href);
  expect(link.pathname).toBe('/buildings/bellway/thesunningdale'); expect(link.searchParams.get('site')).toBe('Abbot Walk');
  await act(async () => { selects[2]!.value = 'England'; selects[2]!.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  expect(new URL(dom.window.location.href).searchParams.get('location')).toBe('England');
  await act(async () => document.querySelector<HTMLButtonElement>('.site-filters button')!.click());
  expect(dom.window.location.search).toBe('');
  await act(async () => { dom.window.history.pushState(null, '', '?bedrooms=4'); dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate')); });
  expect(selects[1]!.value).toBe(''); // Unknown select value has no option; still yields no matches.
  expect(document.querySelectorAll('.collection-card')).toHaveLength(0);
 } finally { await act(async () => root.unmount()); dom.window.close(); }
});

it('restores result searches after refresh and clears the URL when filters are reset', async () => {
 const { Gallery } = await import('../src/web/gallery');
 const dom = new JSDOM('<div id="root"></div>', { url: 'https://local.test/buildings/bellway/thesunningdale?q=green' });
 for (const [name,value] of Object.entries({window:dom.window,self:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,IS_REACT_ACT_ENVIRONMENT:true})) vi.stubGlobal(name,value);
 const root=createRoot(document.getElementById('root')!);
 try {
  await act(async()=>root.render(<Gallery includeUnclassified collections={[{slug:'bellway',name:'Bellway',report:{status:'completed',startedAt:'',model:'',question:'',developments:[],properties:[],errors:[],metrics:{},images:[{id:'green',path:'green.jpg',sourceUrl:'https://example.com/green',verdict:{matches:true,description:'Green desk'}},{id:'blue',path:'blue.jpg',sourceUrl:'https://example.com/blue',verdict:{matches:true,description:'Blue desk'}}]}}]}/>));
  expect(document.querySelector<HTMLInputElement>('.filters input')!.value).toBe('green');
  expect(document.querySelectorAll('.image-card')).toHaveLength(1);
  expect(document.querySelector('.photo-button img')?.getAttribute('src')).toContain('green.jpg');
  await act(async()=>document.querySelector<HTMLButtonElement>('.results-reset')!.click());
  expect(dom.window.location.search).toBe('');
  expect(document.querySelectorAll('.image-card')).toHaveLength(2);
 }finally{await act(async()=>root.unmount());dom.window.close();}
});
