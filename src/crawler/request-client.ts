import { developers } from '../adapters/developers.js';
import { setTimeout as sleep } from 'node:timers/promises';
export class RequestError extends Error { constructor(public readonly status: number) { super(`HTTP ${status}`); } }
export class RequestClient {
 private tail: Promise<void> = Promise.resolve();
 private requests = 0;
 constructor(private options: { delay: number; retries: number; timeout: number; maxRequests: number }, private fetcher: typeof fetch = fetch) {}
 private async gate() {
  const previous = this.tail;
  this.tail = previous.then(() => sleep(this.options.delay));
  await previous;
  if (++this.requests > this.options.maxRequests) throw new Error('Request budget exhausted.');
 }
 async bytes(url: string, maxBytes = 20_000_000): Promise<Buffer> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !['cms.bellway.co.uk', 'data.openasset.com', ...developers.map(d => new URL(d.website).hostname)].includes(parsed.hostname)) throw new Error('URL outside crawler host allowlist.');
  for (let attempt = 0; ; attempt++) {
   await this.gate();
   try {
    const request = async (target: string, redirects = 0): Promise<Response> => {
     const response = await this.fetcher(target, { redirect: 'manual', signal: AbortSignal.timeout(this.options.timeout), headers: { 'User-Agent': 'ShowhomeCrawler/0.2 (bounded public showhome gallery crawler)' } });
     if (![301, 302, 303, 307, 308].includes(response.status)) return response;
     const location = response.headers.get('location');
     if (!location || redirects >= 3) throw new Error('Invalid or excessive redirect.');
     const next = new URL(location, target);
     if (next.origin !== parsed.origin || /^\/(?:new-homes\/results|your-nest\/search-results)/.test(next.pathname)) throw new Error('Redirect outside allowed source.');
     await this.gate(); return request(next.href, redirects + 1);
    };
    const response = await request(url);
    if (!response.ok) throw new RequestError(response.status);
    if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Response exceeds byte limit.');
    if (!response.body) throw new Error('Empty response.');
    const chunks: Uint8Array[] = []; let size = 0;
    for await (const chunk of response.body) { size += chunk.byteLength; if (size > maxBytes) { await response.body.cancel().catch(() => {}); throw new Error('Response exceeds byte limit.'); } chunks.push(chunk); }
    return Buffer.concat(chunks);
   } catch (error) {
    if (attempt >= this.options.retries || (error instanceof RequestError && ![429, 500, 502, 503, 504].includes(error.status))) throw error;
    await sleep(Math.min(30_000, 1000 * 2 ** attempt));
   }
  }
 }
 async text(url: string) { return (await this.bytes(url, 10_000_000)).toString('utf8'); }
}
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
 const output: R[] = []; let next = 0;
 await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
  while (next < items.length) { const index = next++; output[index] = await fn(items[index]!, index); }
 }));
 return output;
}
