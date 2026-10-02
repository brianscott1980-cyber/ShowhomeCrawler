import {expect,it} from 'vitest';
import * as tulloch from '../src/adapters/tulloch/site-parser';
import * as scotia from '../src/adapters/scotia/site-parser';
import {validateBatch} from '../src/vision/gemini-classifier';
it('discovers Tulloch development cards and all gallery images across bedroom counts',()=>{
 expect(tulloch.developmentUrls('<a href="/homes-for-sale/5-inverness">Parks View</a><a href="/homes-for-sale/5-inverness/777-carnegie">Carnegie</a>')).toEqual(['https://www.tulloch-homes.com/homes-for-sale/5-inverness']);
 const result=tulloch.discoverHomes('<title>Parks View | Tulloch</title><li class="property_development_plot_stub_item"><h3><a href="/homes-for-sale/5-inverness/796-etive">Affric</a></h3>Plot 408 £330,000 3 bedrooms</li>','https://www.tulloch-homes.com/homes-for-sale/5-inverness');
 expect(result.homes[0]).toMatchObject({name:'Affric',bedrooms:3,plotNumber:'408',price:330000});
 expect(tulloch.galleryImages('<img class="gallery_image" src="/assets/kitchen.jpg"><img class="floor_plan_gallery_image" src="/assets/plan.png"><img src="/assets/staff.jpg">')).toHaveLength(2);
});
it('extracts Scotia plot metadata and property galleries while excluding navigation images',()=>{
 const url='https://www.scotia-homes.co.uk/developments/dalfaber';
 const result=scotia.discoverHomes('<title>Dalfaber - Scotia</title><a href="/developments/dalfaber/house-types/baird/plot-68"><h3>Baird</h3>4 bedroom detached house £399,950</a>',url);
 expect(result.homes[0]).toMatchObject({name:'Baird',bedrooms:4,plotNumber:'68',price:399950});
 expect(scotia.galleryImages('<div class="imgSlider"><img src="https://scotia-homes-img.s3.amazonaws.com/kitchen.jpg"></div><div class="imgNavSlider"><img src="https://scotia-homes-img.s3.amazonaws.com/thumb.jpg"></div>')).toHaveLength(1);
});
it('allows beds and non-office rooms only in the all-images classifier mode',()=>{
 const body={images:[{imageId:'bedroom',matches:true,hasDesk:false,hasBed:true,hasFloorplan:false,roomType:'Bedroom',description:'A bedroom',reason:'Real room'}]};
 expect(()=>validateBatch(body,['bedroom'])).toThrow('Contradictory classification');
 expect(validateBatch(body,['bedroom'],true)[0]?.verdict.matches).toBe(true);
 expect(()=>validateBatch(body,['wrong'],true)).toThrow('identifiers');
});
