// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { MapPhotoSamples, nextSampleIndex } from '../src/web/map-photo-samples';
it('chooses a different photo and position without excluding any alternative', () => {
 for (let previous = 0; previous < 3; previous++) {
  const next = [nextSampleIndex(3, previous, 0), nextSampleIndex(3, previous, .99)];
  expect(next).not.toContain(previous);
  expect(new Set(next).size).toBe(2);
 }
 expect(nextSampleIndex(1, 0)).toBe(0);
 expect(nextSampleIndex(3, -1, .99)).toBe(2);
});

it('keeps the active house type visible while hovered or focused and resumes after leaving', async () => {
 vi.useFakeTimers();
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
 vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
 const container = document.createElement('div');
 document.body.append(container);
 const root = createRoot(container);
 try {
  await act(async () => root.render(<MapPhotoSamples photos={[{src:'/room.jpg',alt:'Room',builder:'Example',category:'Living Room',houseType:'The Example',houseTypeHref:'/buildings/example/theexample'}]}/>));
  await act(async () => container.querySelector('.map-photo-window img')!.dispatchEvent(new Event('load')));
  await act(async () => vi.advanceTimersByTime(800));
  await act(async () => vi.advanceTimersByTime(900));
  const figure = container.querySelector('figure')!;
  const link = container.querySelector('a')!;
  expect(link.getAttribute('href')).toBe('/buildings/example/theexample');
  expect(figure.textContent).toContain('The Example');
  await act(async () => figure.dispatchEvent(new MouseEvent('mouseover', {bubbles:true})));
  await act(async () => vi.advanceTimersByTime(10000));
  expect(figure.dataset.phase).toBe('hold');
  expect(figure.classList.contains('is-interacting')).toBe(true);
  await act(async () => figure.dispatchEvent(new MouseEvent('mouseout', {bubbles:true})));
  await act(async () => link.dispatchEvent(new FocusEvent('focusin', {bubbles:true})));
  await act(async () => vi.advanceTimersByTime(10000));
  expect(figure.dataset.phase).toBe('hold');
  await act(async () => link.dispatchEvent(new FocusEvent('focusout', {bubbles:true})));
  await act(async () => vi.advanceTimersByTime(4000));
  expect(figure.dataset.phase).toBe('exit');
 } finally {
  await act(async () => root.unmount());
  container.remove();vi.useRealTimers();vi.unstubAllGlobals();
 }
});
