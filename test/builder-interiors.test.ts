import { expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('not found'); } }));
vi.mock('../src/database/website', () => ({
 readWebsiteBuilder: vi.fn(async (slug: string) => slug === 'cala' ? { slug: 'cala', name: 'Cala' } : null),
 findDirectoryReference: vi.fn(async (_kind: string, href: string) => href === '/interiors/bathroom' ? { name: 'Bathroom' } : null),
}));
vi.mock('../src/database/directory-cache', () => ({ cachedDirectory: vi.fn(async () => ({ total: 3, cards: [], counts: {} })) }));
vi.mock('../src/database/gallery-cache', () => ({ cachedGallery: vi.fn(async () => ({ total: 5, images: [], facets: {} })) }));
vi.mock('../src/web/group-pages', () => ({ GroupDirectory: () => null }));
vi.mock('../src/web/results-page', () => ({ ResultsPage: () => null }));
import { seoLanding, seoLandingMetadata } from '../src/web/seo-landings';
import { cachedDirectory } from '../src/database/directory-cache';
import { cachedGallery } from '../src/database/gallery-cache';

it('serves a builder interiors directory with fixed builder scope and canonical metadata', async () => {
 const landing = await seoLanding('/interiors/cala/');
 expect(landing).toMatchObject({ type: 'directory', title: 'Cala Interiors', path: '/interiors/cala', linkBase: '/interiors/cala', fixedFilters: { developer: 'Cala' } });
 expect(cachedDirectory).toHaveBeenCalledWith({ kind: 'interiors', filters: { developer: 'Cala' }, fixedFilters: { developer: 'Cala' } });
 expect(await seoLandingMetadata('/interiors/cala')).toMatchObject({ title: 'Cala Interiors | Showhome Explorer', alternates: { canonical: '/interiors/cala' } });
});

it('keeps room galleries and all-room galleries scoped to the builder', async () => {
 for (const room of ['bathroom', 'all']) {
  expect(await seoLanding(`/interiors/cala/${room}`)).toMatchObject({ type: 'gallery', path: `/interiors/cala/${room}`, back: '/interiors/cala', scope: { kind: 'interiors', href: `/interiors/${room}`, fixedFilters: { developer: 'Cala' } } });
 }
 expect(cachedGallery).toHaveBeenCalledWith({ scope: { kind: 'interiors', href: '/interiors/bathroom', fixedFilters: { developer: 'Cala' } }, filters: { developer: 'Cala' } });
});

it('does not resolve unknown builders or room categories', async () => {
 expect(await seoLanding('/interiors/missing')).toBeNull();
 expect(await seoLanding('/interiors/cala/missing')).toBeNull();
});

it('resolves previous builder-first URLs to the new canonical path', async () => {
 expect(await seoLanding('/cala/interiors/all')).toMatchObject({path:'/interiors/cala/all'});
 expect(await seoLandingMetadata('/cala/interiors')).toMatchObject({alternates:{canonical:'/interiors/cala'}});
});
