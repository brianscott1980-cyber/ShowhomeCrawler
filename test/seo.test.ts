import {expect,it,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {developerSeo,siteUrl} from '../src/web/seo';
vi.mock('../src/web/collections',()=>({developers:[{slug:'full'},{slug:'empty'}],readCollection:async(slug:string)=>({completedAt:'2026-10-02T12:00:00Z',images:slug==='full'?[{id:'one',path:'images/one.jpg',verdict:{matches:true}},{id:'two',path:'images/two.jpg',verdict:{matches:false}}]:[]}),assetUrl:(slug:string,path:string)=>`/api/assets/${slug}/${path}`}));
import sitemap from '../src/app/sitemap';
import robots from '../src/app/robots';
it('includes only indexable collections and their qualifying image URLs in the sitemap',async()=>{
 const entries=await sitemap();expect(entries.map(e=>e.url)).toContain(siteUrl+'/developers/full');expect(entries.map(e=>e.url)).not.toContain(siteUrl+'/developers/empty');expect(entries.find(e=>e.url.endsWith('/developers/full'))?.images).toEqual([siteUrl+'/api/assets/full/images/one.jpg']);expect(entries.find(e=>e.url.endsWith('/developers/full'))?.lastModified).toBe('2026-10-02T12:00:00Z');
});
it('allows gallery image crawling and declares the sitemap',()=>{expect(robots().sitemap).toBe(siteUrl+'/sitemap.xml');expect(JSON.stringify(robots().rules)).not.toContain('/api/assets');});
it('escapes metadata and structured data while providing canonical and image sharing information',()=>{
 const dom=new JSDOM('<head>'+developerSeo('A & B','full',[{path:'/api/assets/full/images/one.jpg',description:'</script><script>bad</script>'}])+'</head>');
 const doc=dom.window.document;expect(doc.querySelector('link[rel=canonical]')?.getAttribute('href')).toBe(siteUrl+'/developers/full');expect(doc.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(siteUrl+'/api/assets/full/images/one.jpg');expect(doc.querySelectorAll('script')).toHaveLength(1);expect(JSON.parse(doc.querySelector('script')!.textContent!).mainEntity.numberOfItems).toBe(1);dom.window.close();
});
it('keeps empty collections out of search results',()=>{expect(developerSeo('Empty','empty',[])).toContain('noindex, follow');});
