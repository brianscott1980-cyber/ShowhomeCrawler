import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
vi.mock('../src/web/collections', () => ({
 developers: [{ slug: 'visible', name: 'Visible' }, { slug: 'empty', name: 'Empty' }, { slug: 'pending', name: 'Pending' }, { slug: 'missing', name: 'Missing' }, { slug: 'rejected', name: 'Rejected' }],
 assetUrl: (slug: string, path: string) => `/api/assets/${slug}/${path}`,
 readCollection: async (slug: string) => slug === 'missing' ? null : ({ images: slug === 'empty' ? [] : [{ path: 'image.jpg', verdict: slug === 'pending' ? undefined : { matches: slug !== 'rejected' } }] }),
}));
import Home from '../src/app/homebuilders/page';
it('lists only collections containing qualifying images', async () => {
 const dom = new JSDOM(renderToStaticMarkup(await Home()));
 expect([...dom.window.document.querySelectorAll('.collection-card')].map(card => card.getAttribute('href'))).toEqual(['/developers/visible']);
 dom.window.close();
});
