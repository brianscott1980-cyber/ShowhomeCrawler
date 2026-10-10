// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { Gallery } from '../src/web/gallery';
import type { RunReport } from '../src/reports/report';

it('opens the requested image immediately and does not reopen it after closing', async () => {
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
 const show = vi.fn(function (this: HTMLDialogElement) { this.setAttribute('open', ''); });
 const close = vi.fn(function (this: HTMLDialogElement) { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); });
 Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {configurable:true,value:show});
 Object.defineProperty(HTMLDialogElement.prototype, 'close', {configurable:true,value:close});
 window.history.replaceState(null, '', '/buildings/builder/example?image=builder%3Aclicked&category=Living+Room#collection');
 const container = document.createElement('div');document.body.append(container);
 const root = createRoot(container);
 const source=(image:Element|null)=>{const src=image?.getAttribute('src')??'';return new URL(src,'http://localhost').searchParams.get('url')??src;};
 const report = { properties: [], images: ['first', 'clicked'].map(id => ({ id, path: `${id}.jpg`, verdict: {matches:true,description:id}, categorisation:{mainCategory:'Living Room',isRoom:true,colours:[],chairs:[],objects:[]} })) } as unknown as RunReport;
 try {
  await act(async () => root.render(<Gallery collections={[{slug:'builder',name:'Builder',report}]} initialImage="builder:clicked" introduction={{title:'Example',description:'Interiors',eyebrow:'Builder'}} includeUnclassified/>));
  expect(show).toHaveBeenCalledTimes(1);
  expect(container.querySelector('dialog')?.hasAttribute('open')).toBe(true);
  expect(container.querySelector('.results-full-image')?.getAttribute('src')).toBe('/api/assets/builder/clicked.jpg');
  expect(container.querySelector('[aria-current="true"]')?.getAttribute('aria-label')).toBe('View image 2');
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Close image"]')!.click());
  expect(close).toHaveBeenCalledTimes(1);
  expect(window.location.pathname + window.location.search + window.location.hash).toBe('/buildings/builder/example#collection');
  expect(container.querySelector('dialog')?.hasAttribute('open')).toBe(false);
  expect(show).toHaveBeenCalledTimes(1);
  expect(source(container.querySelector('.results-hero-image img'))).toBe('/api/assets/builder/clicked.jpg');
  const progress = container.querySelector('.results-slide-progress span')!;
  await act(async () => progress.dispatchEvent(new Event('webkitAnimationEnd', {bubbles:true})));
  expect(source(container.querySelector('.results-hero-image img'))).toBe('/api/assets/builder/first.jpg');
  expect(container.querySelector('.results-slide-progress span')).not.toBe(progress);
 } finally {
  await act(async () => root.unmount());container.remove();window.history.replaceState(null, '', '/');vi.restoreAllMocks();vi.unstubAllGlobals();
 }
});
