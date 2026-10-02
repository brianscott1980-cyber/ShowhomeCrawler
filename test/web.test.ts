import { describe, expect, it } from 'vitest';
import { GET as asset } from '../src/app/api/assets/[slug]/[...path]/route';
import { POST as job } from '../src/app/api/jobs/route';
import { collectionFolder } from '../src/web/collections';
import { jobInput } from '../src/web/jobs';

describe('Web app boundaries', () => {
 it('rejects path traversal, credentials and unknown collections', async () => {
  for (const path of [['..', '..', '.env.local'], ['.lock'], ['checkpoint.json'], ['images', 'not-an-image.jpg']]) {
   expect((await asset(new Request('http://localhost/api/assets'), { params: Promise.resolve({ slug: 'bellway', path }) })).status).toBe(404);
  }
  expect(() => collectionFolder('../outside')).toThrow('Unknown developer');
  expect((await asset(new Request('http://localhost/api/assets'), { params: Promise.resolve({ slug: 'unknown', path: ['results.json'] }) })).status).toBe(404);
 });
 it('rejects cross-site and non-local processing requests before launching work', async () => {
  const input = JSON.stringify({ developer: 'bellway', action: 'crawl' });
  expect((await job(new Request('http://localhost/api/jobs', { method: 'POST', headers: { origin: 'https://other.test' }, body: input }))).status).toBe(403);
  expect((await job(new Request('https://public.test/api/jobs', { method: 'POST', headers: { origin: 'https://public.test' }, body: input }))).status).toBe(403);
 });
 it('validates processing budgets and action names without executing shell input', async () => {
  expect(jobInput.parse({ developer: 'cala', action: 'crawl' }).maxImages).toBe(20000);
  for (const input of [
   { developer: 'cala; echo bad', action: 'crawl' },
   { developer: 'cala', action: 'shell' },
   { developer: 'cala', action: 'crawl', maxImages: 20001 },
   { developer: 'cala', action: 'crawl', maxDevelopments: 0 },
  ]) {
   expect((await job(new Request('http://localhost/api/jobs', { method: 'POST', headers: { origin: 'http://localhost' }, body: JSON.stringify(input) }))).status).toBe(400);
  }
 });
});
