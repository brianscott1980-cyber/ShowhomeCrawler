import {afterEach,expect,it,vi} from 'vitest';
vi.mock('node:fs/promises',()=>({realpath:vi.fn().mockRejectedValue(Object.assign(new Error('Missing'),{code:'ENOENT'})),readFile:vi.fn()}));
vi.mock('../src/web/content-storage',()=>({storedImage:vi.fn().mockRejectedValue(new Error('Unavailable'))}));
vi.mock('../src/web/collections',()=>({collectionFolder:()=>'/collections/example',readCollection:async()=>({images:[{id:'a'.repeat(64),path:`images/${'a'.repeat(64)}.jpg`,sourceUrl:'https://builder.example/photo.jpg'}]})}));
import {GET} from '../src/app/api/assets/[slug]/[...path]/route';
const params=Promise.resolve({slug:'example',path:['images',`${'a'.repeat(64)}.jpg`]});
afterEach(()=>vi.unstubAllGlobals());
it('returns image bytes for optimization when originals are not bundled',async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'image/jpeg'}}));vi.stubGlobal('fetch',fetch);
 const response=await GET(new Request('https://site.example/api/assets/example/image?optimize=1'),{params});
 expect(response.status).toBe(200);expect(response.headers.get('Content-Type')).toBe('image/jpeg');expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1,2,3]));expect(fetch).toHaveBeenCalledOnce();
});
it('retains source redirects for original image requests',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 const response=await GET(new Request('https://site.example/api/assets/example/image'),{params});
 expect(response.status).toBe(307);expect(response.headers.get('Location')).toBe('https://builder.example/photo.jpg');expect(fetch).not.toHaveBeenCalled();
});
it('rejects oversized upstream images before downloading their body',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(null,{headers:{'Content-Length':String(21*1024*1024)}})));
 const response=await GET(new Request('https://site.example/api/assets/example/image?optimize=1'),{params});expect(response.status).toBe(502);
});
