import {expect,it} from 'vitest';
import {developmentUrls,discoverHomes,galleryImages,enrichPage} from '../src/adapters/ajc/site-parser';
it('uses current development links and retains two bedroom homes',()=>{
 expect(developmentUrls('<a href="/developments/castlepark">CastlePark</a><a href="/developments/castlepark/homes/plot-1">Plot</a>')).toEqual(['https://ajcscotland.com/developments/castlepark']);
 const result=discoverHomes('<title>CastlePark | New homes in Aboyne | AJC Scotland</title><article><h3>Cairnwell</h3><p>2 bed detached £209,995</p><a href="/developments/castlepark/homes/plot-1">Details</a></article>','https://ajcscotland.com/developments/castlepark');
 expect(result.development.name).toBe('CastlePark');expect(result.plots[0]).toMatchObject({name:'Cairnwell',bedrooms:2,price:209995});
});
it('collects public original and responsive property images and preserves map coordinates',async()=>{
 expect(galleryImages('<img src="/assets/kitchen.jpg"><img src="/images/made/assets/bedroom_800.jpg"><header><img src="/assets/logo.svg"></header>').map(i=>i.url)).toHaveLength(2);
 expect(await enrichPage('<iframe src="https://www.google.com/maps/embed?pb=!2d-2.8017!3d57.0796"></iframe>')).toContain('"latitude":57.0796');
});
