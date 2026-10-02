import { it, expect } from 'vitest';
import { discoverSitemapDevelopments } from '../src/crawler/sitemaps';
it('follows nested sitemap indexes without duplicate fetches', async () => {
 const calls: string[] = [];
 const pages: Record<string,string> = {'https://test.com/index.xml':'<sitemapindex><sitemap><loc>https://test.com/homes.xml</loc></sitemap><sitemap><loc>https://test.com/homes.xml</loc></sitemap></sitemapindex>','https://test.com/homes.xml':'<urlset/>'};
 const urls = await discoverSitemapDevelopments('https://test.com/index.xml', xml => xml.includes('urlset') ? ['https://test.com/development'] : [], async url => { calls.push(url); return pages[url]!; });
 expect(calls).toHaveLength(2); expect(urls).toEqual(['https://test.com/development']);
});
it('rejects cross-origin sitemap indexes before fetching them', async () => {
 const calls:string[]=[];
 await expect(discoverSitemapDevelopments('https://test.com/index.xml',()=>[],async url=>{calls.push(url);return '<sitemapindex><sitemap><loc>https://other.com/index.xml</loc></sitemap></sitemapindex>'; })).rejects.toThrow('bounds');
 expect(calls).toHaveLength(1);
});
