import { describe, expect, it } from 'vitest';
import { choosePhotoPosition } from '../src/web/map-photo-position';

describe('map photo placement', () => {
 it('keeps a dense group of related sites visible', () => {
  const dots = Array.from({ length: 30 }, (_, i) => ({ x: 240 + i % 6 * 12, y: 180 + Math.floor(i / 6) * 12, related: true }));
  const frame = choosePhotoPosition(500, 600, 280, 170, dots);
  expect(dots.every(dot => dot.x < frame.left - 14 || dot.x > frame.left + 294 || dot.y < frame.top - 14 || dot.y > frame.top + 184)).toBe(true);
  expect(frame.left).toBeGreaterThanOrEqual(12);
  expect(frame.left + 280).toBeLessThanOrEqual(488);
  expect(frame.top + 170).toBeLessThanOrEqual(588);
 });

 it('prioritizes related dots over unrelated dots when coverage is unavoidable', () => {
  const dots = [{ x: 60, y: 60, related: true }, ...Array.from({ length: 50 }, () => ({ x: 340, y: 60, related: false }))];
  const frame = choosePhotoPosition(400, 120, 240, 96, dots);
  expect(frame.left).toBeGreaterThan(74);
 });

 it('handles mobile dimensions and sites outside the visible map', () => {
  const frame = choosePhotoPosition(320, 600, 200, 120, [{ x: -100, y: -100, related: true }]);
  expect(frame).toEqual({ left: 12, top: 12 });
 });
});
