import {expect,it} from 'vitest';
import {hasImageCategory,isCategorisedImage} from '../src/web/image-classification';
import type {ReportImage} from '../src/reports/report';
it('requires a named classification and preserves HTML and legacy AI classifications',()=>{
 expect(isCategorisedImage({})).toBe(false);
 for(const category of ['', 'Other','Uncategorised','Uncategorized','Unknown'])expect(hasImageCategory(category)).toBe(false);
 expect(isCategorisedImage({categorisation:{mainCategory:'Bedroom',categorisationSource:'website-html'}} as ReportImage)).toBe(true);
 expect(isCategorisedImage({verdict:{matches:true,roomType:'Kitchen'}} as ReportImage)).toBe(true);
 expect(isCategorisedImage({verdict:{matches:true}} as ReportImage)).toBe(false);
});
it('removes uncategorised card previews while retaining builder branding',async()=>{
 const {cardImageCollection}=await import('../src/web/card-images');
 const logo={src:'/logo.svg',alt:'Builder',kind:'logo' as const};
 expect(cardImageCollection([{src:'/unknown',alt:'Unknown'},{src:'/room',alt:'Bedroom',roomType:'Bedroom'}],logo).images.map(image=>image.src)).toEqual(['/logo.svg','/room']);
});
it('hides illustrations and infographics globally while excluding exteriors and floorplans only from interiors',async()=>{
 const {isInteriorCategory}=await import('../src/web/image-classification');
 for(const category of ['Infographic','Illustration'])expect(hasImageCategory(category)).toBe(false);
 for(const category of ['Exterior','Floorplan']){expect(hasImageCategory(category)).toBe(true);expect(isInteriorCategory(category)).toBe(false);}
 expect(isInteriorCategory('Bedroom')).toBe(true);
});
