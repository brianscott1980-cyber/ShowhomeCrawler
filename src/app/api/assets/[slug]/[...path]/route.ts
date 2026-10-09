import {findWebsiteImage} from '../../../../../database/website';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { collectionFolder } from '../../../../../web/collections';
export const runtime = 'nodejs';
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; path: string[] }> }) {
 const { slug, path } = await params;
 const relative = path.join('/');
 if (!/^(images\/[a-f0-9]{64}\.(jpg|jpeg|png|webp|avif|gif|tiff)|results\.json|properties\.csv|matches\.csv|full-report\.html)$/.test(relative)) return new Response('Not found', { status: 404 });
 if (relative.startsWith('images/')) {
  try {
   const imageId = relative.replace(/^images\/|\.[^.]+$/g, '');
   const image = await findWebsiteImage(slug, relative, imageId);
   if (!image?.sourceUrl) return new Response('Not found', { status: 404 });
   const source = new URL(image.sourceUrl);
   if (source.protocol !== 'https:' && source.protocol !== 'http:') return new Response('Invalid image source', { status: 502 });
   return new Response(null, { status: 307, headers: { Location: source.href, 'Cache-Control': 'public, max-age=86400' } });
  } catch {
   return new Response('Image source unavailable', { status: 502 });
  }
 }
 try {
  const root = await realpath(collectionFolder(slug));
  const file = await realpath(resolve(root, relative));
  if (file.startsWith(root + sep)) {
   const ext = relative.split('.').at(-1)!;
   const types: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif', tiff: 'image/tiff', json: 'application/json', csv: 'text/csv', html: 'text/html' };
   return new Response(new Uint8Array(await readFile(file)), { headers: { 'Content-Type': types[ext] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', ...(relative.startsWith('images/')?{}:{'X-Robots-Tag':'noindex'}), 'Content-Disposition': relative.startsWith('images/') ? 'inline' : `attachment; filename="${relative}"`, 'Cache-Control': relative.startsWith('images/') ? 'public, max-age=31536000, immutable' : 'no-store' } });
  }
 } catch {
  // Local collection file not found or not in collectionFolder
 }
 return new Response('Not found', { status: 404 });
}
