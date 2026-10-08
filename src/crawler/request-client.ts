import { developers } from '../adapters/developers.js';
import { setTimeout as sleep } from 'node:timers/promises';
import { spawn } from 'node:child_process';
export class RequestError extends Error { constructor(public readonly status: number) { super(`HTTP ${status}`); } }

function curlFallback(url: string, timeoutMs: number, body?:string): Promise<Response> {
 return new Promise((resolve, reject) => {
  const proc = spawn('curl', [
   '-sL',
   '--http1.1',
   '-i',
   '--max-time', String(Math.ceil(timeoutMs / 1000)),
   '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
   '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
   ...(body===undefined?[]:['-X','POST','--data',body]),
   url
  ]);
  const chunks: Buffer[] = [];
  proc.stdout.on('data', c => chunks.push(c));
  proc.on('close', code => {
   if (code !== 0) return reject(new Error(`curl exited ${code}`));
   const buf = Buffer.concat(chunks);
   const sep = buf.indexOf(Buffer.from('\r\n\r\n'));
   const headerStr = sep > -1 ? buf.slice(0, sep).toString('utf8') : '';
   const body = sep > -1 ? buf.slice(sep + 4) : buf;
   const statusLine = headerStr.split('\r\n')[0] ?? '';
   const status = parseInt(statusLine.split(' ')[1] ?? '200', 10);
   resolve(new Response(body, { status, statusText: status >= 200 && status < 300 ? 'OK' : 'Error' }));
  });
 });
}

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
 async bytes(url: string, maxBytes = 20_000_000, body?:string): Promise<Buffer> {
  const parsed = new URL(url);
  const isAllowedHost = ['collegepark.uk', 'res.cloudinary.com', 'mvdataappstorageeunlprod.blob.core.windows.net', 'accelerated-cf-eunl.mediavalet.com', 'cdn.mediavalet.com', 'scotia-homes-img.s3.amazonaws.com', 'cms.bellway.co.uk', 'data.openasset.com', 'www.marleighpark.co.uk'].includes(parsed.hostname) ||
    developers.some(d => {
      const h = new URL(d.website).hostname;
      return parsed.hostname === h || parsed.hostname.endsWith('.' + h.replace(/^www\./, ''));
    });
  if (parsed.protocol !== 'https:' || !isAllowedHost) throw new Error('URL outside crawler host allowlist.');
  for (let attempt = 0; ; attempt++) {
   await this.gate();
   try {
    const request = async (target: string, redirects = 0): Promise<Response> => {
     let response = await this.fetcher(target, { redirect: 'manual', signal: AbortSignal.timeout(this.options.timeout), method:body===undefined?'GET':'POST',body,headers: { ...(body===undefined?{}:{'Content-Type':'application/x-www-form-urlencoded'}), 'User-Agent': 'ShowhomeCrawler/0.2 (bounded public showhome gallery crawler)' } });
     if (response.status === 403) {
      try {
       const fallback = await curlFallback(target, this.options.timeout,body);
       if (fallback.ok) response = fallback;
      } catch {}
     }
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
 async text(url: string,body?:string) { return (await this.bytes(url, 10_000_000,body)).toString('utf8'); }
}
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
 const output: R[] = []; let next = 0,failed=false;
 const tasks=await Promise.allSettled(Array.from({ length: Math.min(limit, items.length) }, async () => {
  while (!failed&&next < items.length) { const index = next++;try{output[index] = await fn(items[index]!, index);}catch(error){failed=true;throw error;} }
 }));
 const failure=tasks.find(task=>task.status==='rejected');
 if(failure?.status==='rejected')throw failure.reason;
 return output;
}
