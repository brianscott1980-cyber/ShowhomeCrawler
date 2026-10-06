import {findWebsiteImage} from '../../../../../database/website';
import {storedImage} from '../../../../../web/content-storage';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { collectionFolder } from '../../../../../web/collections';
export const runtime = 'nodejs';
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; path: string[] }> }) {
 const { slug, path } = await params;
 const relative = path.join('/');
 if (!/^(images\/[a-f0-9]{64}\.(jpg|jpeg|png|webp|avif|gif|tiff)|results\.json|properties\.csv|matches\.csv|full-report\.html)$/.test(relative)) return new Response('Not found', { status: 404 });
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
 if (relative.startsWith('images/')) {
  try {
   const id=relative.replace(/^images\/|\.[^.]+$/g,'');
   const {bytes,extension}=await storedImage(id,relative.split('.').at(-1)!,resolve(collectionFolder(slug),relative));
   const types:Record<string,string>={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',avif:'image/avif',gif:'image/gif',tiff:'image/tiff'};
   return new Response(new Uint8Array(bytes),{headers:{'Content-Type':types[extension]??'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }catch{ /* Try the legacy collection below. */ }

  try {
   const resultsRoot = resolve('results', `${slug}-home-offices`);
   const localFile = await realpath(resolve(resultsRoot, relative));
   if (localFile.startsWith((await realpath(resultsRoot)) + sep)) {
    const ext = relative.split('.').at(-1)!;
    const types: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif', tiff: 'image/tiff' };
    return new Response(new Uint8Array(await readFile(localFile)), { headers: { 'Content-Type': types[ext] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline', 'Cache-Control': 'public, max-age=31536000, immutable' } });
   }
  } catch {
   // Results file not found locally
  }
  try {
   const imageId = relative.replace(/^images\/|\.[^.]+$/g, '');
   const image = await findWebsiteImage(slug,relative,imageId);
   if (image?.sourceUrl) {
    if(new URL(_request.url).searchParams.get('optimize')==='1'){
     const source=new URL(image.sourceUrl);
     if(source.protocol!=='https:')return new Response('Invalid image source',{status:502});
     const response=await fetch(source,{signal:AbortSignal.timeout(15000)});
     if(!response.ok||Number(response.headers.get('content-length')??0)>20*1024*1024)return new Response('Image source unavailable',{status:502});
     const bytes=await response.arrayBuffer();
     if(bytes.byteLength>20*1024*1024)return new Response('Image too large',{status:413});
     return new Response(bytes,{headers:{'Content-Type':response.headers.get('content-type')??'application/octet-stream','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});
    }
    return new Response(null, { status: 307, headers: { Location: image.sourceUrl, 'Cache-Control': 'public, max-age=86400' } });
   }
  } catch {
   // Fall through to 404
  }
 }
 return new Response('Not found', { status: 404 });
}
