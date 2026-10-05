import {it,expect} from 'vitest';
import {discoverHomes,galleryImages,enrichPage} from './site-parser.js';
it('requires complete rendered-list coverage and extracts home type and plot metadata',()=>{const html='<h1>Example</h1><div id="crawler-coverage"></div><a class="standard_home_card" href="/developments/county/site/homes/the-winchester/32"><div class="title"><h2>The Winchester</h2><h3>HOME 32</h3></div><div class="property_price_info"><p>5 bedroom detached home</p><h4>£950,000</h4></div></a>';expect(discoverHomes(html,'https://www.crestnicholson.com/developments/county/site').homes[0]).toMatchObject({name:'The Winchester',plotNumber:'32',bedrooms:5,price:950000});expect(()=>discoverHomes('<h1>Example</h1>','https://www.crestnicholson.com/developments/county/site')).toThrow('coverage');});
it('extracts plot gallery images and excludes separate floorplan graphics',()=>{expect(galleryImages('<div class="plots_gallery"><div class="image_slide"><img src="/uploads/study.jpg"></div></div><div class="floorplans"><img src="/uploads/plan.jpg"></div>')).toHaveLength(1);});

it('paginates public cards with all filters and does not trust a zero count',async()=>{
 const card=(number:number)=>`<a class="standard_home_card" href="/developments/county/site/homes/type/${number}"><div class="title"><h2>Type</h2></div><div class="property_price_info"><p>2 bedroom home</p></div></a>`;
 const calls:string[]=[];
 const html=await enrichPage('<h1 class="development__header-title">Site</h1><section class="homes_grid_section"><div class="homes_grid"></div></section><script>const developmentId = parseInt(123, 10);</script>',async(_url,body)=>{calls.push(body!);return JSON.stringify({count:0,html:calls.length===1?Array.from({length:24},(_,i)=>card(i)).join(''):card(24)});});
 expect(calls).toHaveLength(2);expect(calls[0]).toContain('beds=all&price=all');expect(calls[1]).toContain('offset=24');expect(discoverHomes(html,'https://www.crestnicholson.com/developments/county/site').homes).toHaveLength(25);
});
it('preserves development photos without attributing redirected plot galleries to a house',()=>{
 const html='<section class="homes_grid_section"></section><section class="development-hero"><img src="/uploads/site.jpg"></section>';
 expect(galleryImages(html,'https://www.crestnicholson.com/developments/county/site')).toHaveLength(1);
 expect(galleryImages(html,'https://www.crestnicholson.com/developments/county/site/homes/type/1')).toHaveLength(0);
});
