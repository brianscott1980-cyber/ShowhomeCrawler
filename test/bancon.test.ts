import {expect,it} from 'vitest';
import {developmentUrls,discoverHomes,galleryImages,enrichPage} from '../src/adapters/bancon/site-parser';
const origin='https://banconhomes.com';
it('discovers development pages and retains small home types from property cards',()=>{
 expect(developmentUrls(`<urlset><url><loc>${origin}/development/kinion-heights/</loc></url><url><loc>${origin}/property/plot-47/</loc></url></urlset>`)).toEqual([origin+'/development/kinion-heights/']);
 const r=discoverHomes('<title>Kinion Heights - Bancon Homes</title><div class="uk-card"><h3>The Loch</h3><p>2 Bedroom Mid-Terraced Home £209,995</p><a href="/property/plot-47/">Find out more</a></div>',origin+'/development/kinion-heights/');
 expect(r.development.name).toBe('Kinion Heights');expect(r.plots[0]).toMatchObject({name:'The Loch',bedrooms:2,price:209995});expect(r.homes).toHaveLength(2);
});
it('collects lazy-loaded interiors, full-size floorplans and backgrounds while excluding the header',()=>{
 const html='<header><img src="/app/uploads/logo.png"></header><section id="content"><img src="data:image/gif;base64,x" data-lazy-src="/app/uploads/kitchen.jpg"><a href="/app/uploads/floorplan.png">Floorplan</a><div style="background-image:url(/app/uploads/exterior.jpg)"></div></section>';
 expect(galleryImages(html).map(i=>i.url)).toEqual([origin+'/app/uploads/kitchen.jpg',origin+'/app/uploads/floorplan.png',origin+'/app/uploads/exterior.jpg']);
});
it('persists the development coordinates from its Google map embed',async()=>{
 const html=await enrichPage('<body><iframe data-lazy-src="https://www.google.com/maps/embed?pb=!2d-2.2017!3d57.1821"></iframe></body>');
 expect(html).toContain('"latitude":57.1821');expect(html).toContain('"longitude":-2.2017');
});
