import sharp from 'sharp';
import {expect,it,vi} from 'vitest';
import * as tulloch from '../src/adapters/tulloch/site-parser';
import * as scotia from '../src/adapters/scotia/site-parser';
import {extractBaseCategorisation} from '../src/vision/image-categoriser';
import {classifyBatch,validateBatch} from '../src/vision/gemini-classifier';
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

it('categorises a floorplan as a graphic even when its description names rooms',()=>{
 const cat=extractBaseCategorisation('floorplan','A ground floor plan with kitchen, living room and WC.','Architectural diagram.');
 expect(cat.mainCategory).toBe('Floorplan');expect(cat.isRoom).toBe(false);
});

it('binds short model labels back to full image identities even when answers are reordered',async()=>{
 const ids=['a'.repeat(64),'b'.repeat(64)];
 const bytes=await sharp({create:{width:2,height:2,channels:3,background:'#fff'}}).png().toBuffer();
 const response={candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({images:[2,1].map(n=>({imageId:`image-${n}`,matches:true,hasDesk:false,hasBed:true,hasFloorplan:false,roomType:'Bedroom',description:`Bedroom ${n}`,reason:'Real room'}))})}]}}]};
 const request=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify(response),{status:200}));
 try{
  const answers=await classifyBatch(ids.map(id=>({id,bytes})),'test-key','test-model',true);
  expect(answers.map(answer=>answer.id)).toEqual([ids[1],ids[0]]);
  expect(answers[0]?.verdict.description).toBe('Bedroom 2');
  const body=JSON.parse(request.mock.calls[0]![1]!.body as string);
  expect(body.generationConfig.responseSchema.properties.images.items.properties.imageId.enum).toEqual(['image-1','image-2']);
 }finally{request.mockRestore();}
});
