import {expect,it} from 'vitest';
import {developmentUrls,discoverHomes,galleryImages} from '../src/adapters/dandara/site-parser';
it('prioritises Scottish development pages without mistaking plots or English developments for sites',()=>{
 const origin='https://www.dandara.com';
 const urls=['/new-homes-for-sale/scotland/aberdeen/hazelwood/','/new-homes-for-sale/scotland/aberdeen/hazelwood/the-ash/','/new-homes-for-sale/new-homes-east-lothian/wallyford/wallyford/','/new-homes-for-sale/new-homes-west-sussex/yapton/paddock-view/'];
 expect(developmentUrls('<urlset>'+urls.map(u=>`<url><loc>${origin}${u}</loc></url>`).join('')+'</urlset>')).toEqual([origin+urls[0],origin+urls[2]]);
});
it('collects smaller homes and the site gallery while retaining advertised prices',()=>{
 const url='https://www.dandara.com/new-homes-for-sale/scotland/aberdeen/hazelwood/';
 const result=discoverHomes('<div id="vue-search-results" data-dev-id="62"></div><h1>Hazelwood <span>Aberdeen</span> AB21 9XX</h1><article><a href="'+url+'the-ash/"><h3>The Ash</h3><span>2 bedrooms £225,000</span></a></article>',url);
 expect(result.development.name).toBe('Hazelwood');expect(result.plots[0]).toMatchObject({bedrooms:2,price:225000});expect(result.homes).toHaveLength(2);
});
it('retains room photos and floorplans, deduplicating thumbnails without collecting unrelated branding',()=>{
 const html='<div class="gallery"><img src="/assets/kitchen.jpg"><img src="/assets/floorplan.jpg"><img src="/assets/kitchen.jpg"><img src="/images/dandara-logo.svg"></div><img src="/assets/news.jpg">';
 expect(galleryImages(html).map(i=>i.url)).toEqual(['https://www.dandara.com/assets/kitchen.jpg','https://www.dandara.com/assets/floorplan.jpg']);
});

it('rejects retired development pages and aliases instead of publishing their marketing destination as a new site',()=>{
 const url='https://www.dandara.com/new-homes-for-sale/scotland/aberdeen/the-grange/';
 expect(()=>discoverHomes('<h1>New Homes in Aberdeen</h1>',url)).toThrow('Retired or redirected');
 expect(()=>discoverHomes('<div id="vue-search-results" data-dev-id="62"></div><link rel="canonical" href="https://www.dandara.com/new-homes-for-sale/scotland/aberdeen/hazelwood/"><h1>Hazelwood</h1>',url)).toThrow('Retired or redirected');
});
