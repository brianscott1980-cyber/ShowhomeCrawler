import {afterEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({findImage:vi.fn(),readFile:vi.fn(),realpath:vi.fn()}));
vi.mock('../src/database/website',()=>({findWebsiteImage:mocks.findImage}));
vi.mock('node:fs/promises',()=>({realpath:mocks.realpath,readFile:mocks.readFile}));
vi.mock('../src/web/collections',()=>({collectionFolder:()=>'/collections/example'}));
import {GET} from '../src/app/api/assets/[slug]/[...path]/route';
import {optimizedImageSource} from '../src/web/optimized-image-source';
const params=Promise.resolve({slug:'example',path:['images',`${'a'.repeat(64)}.jpg`]});
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
it.each(['','?optimize=1'])('redirects image requests directly without fetching or reading image bytes (%s)',async(query)=>{
 mocks.findImage.mockResolvedValue({sourceUrl:'https://builder.example/photo.jpg'});
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 const response=await GET(new Request(`https://site.example/api/assets/example/image${query}`),{params});
 expect(response.status).toBe(307);expect(response.headers.get('Location')).toBe('https://builder.example/photo.jpg');
 expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400');
 expect(await response.text()).toBe('');expect(fetch).not.toHaveBeenCalled();expect(mocks.realpath).not.toHaveBeenCalled();expect(mocks.readFile).not.toHaveBeenCalled();
});
it('returns 404 for missing source images',async()=>{
 mocks.findImage.mockResolvedValue(null);
 expect((await GET(new Request('https://site.example/image'),{params})).status).toBe(404);
});
it('rejects non-web redirect destinations',async()=>{
 mocks.findImage.mockResolvedValue({sourceUrl:'file:///secret'});
 expect((await GET(new Request('https://site.example/image'),{params})).status).toBe(502);
});
it('keeps card image URLs direct',()=>{
 expect(optimizedImageSource('/api/assets/example/images/photo.jpg')).toBe('/api/assets/example/images/photo.jpg');
});
