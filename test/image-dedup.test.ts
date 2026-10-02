import { describe, expect, it, vi } from 'vitest';
import { ImageSourceCache, imageSourceKey } from '../src/galleries/image-source-cache.js';

describe('Image source deduplication before download and classification', () => {
 it('shares concurrent and subsequent work for filename size variants', async () => {
  const cache = new ImageSourceCache<string>();
  const process = vi.fn(async () => 'image-id');
  const reused = vi.fn();
  const ids = await Promise.all([
   cache.get('https://cms.bellway.co.uk/photos/study.jpg?width=800', process, reused),
   cache.get('https://cms.bellway.co.uk/photos/study.jpg?width=1600#photo', process, reused),
  ]);
  expect(ids).toEqual(['image-id', 'image-id']);
  expect(process).toHaveBeenCalledTimes(1);
  expect(reused).toHaveBeenCalledTimes(1);
  await cache.get('https://cms.bellway.co.uk/photos/study.jpg', process, reused);
  expect(process).toHaveBeenCalledTimes(1);
 });
 it('keeps different hosts, directories, filenames and source selectors distinct', () => {
  const urls = [
   'https://cms.bellway.co.uk/a/study.jpg',
   'https://www.cala.co.uk/a/study.jpg',
   'https://cms.bellway.co.uk/b/study.jpg',
   'https://cms.bellway.co.uk/a/Study.jpg',
   'https://cms.bellway.co.uk/a/study.jpg?image=other',
   'https://cms.bellway.co.uk/a/study.jpg?crop=bed',
  ];
  expect(new Set(urls.map(imageSourceKey)).size).toBe(urls.length);
 });
 it('retries failed downloads instead of permanently caching omissions', async () => {
  const cache = new ImageSourceCache<string>();
  const process = vi.fn().mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('download failed')).mockResolvedValueOnce('id');
  const url = 'https://cms.bellway.co.uk/photos/study.jpg';
  expect(await cache.get(url, process, () => {})).toBeNull();
  await expect(cache.get(url, process, () => {})).rejects.toThrow('download failed');
  expect(await cache.get(url, process, () => {})).toBe('id');
  expect(process).toHaveBeenCalledTimes(3);
 });
});
