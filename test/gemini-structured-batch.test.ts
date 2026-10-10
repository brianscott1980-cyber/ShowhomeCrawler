import {expect,it,vi} from 'vitest';
import sharp from 'sharp';
import {classifyStructuredBatch} from '../src/vision/gemini-structured-batch';
const category={interiorColours:[],furnishings:[],mainCategory:'Living Room',subCategory:'',description:'Room',objects:[],colours:[],decor:[],wallpaperTags:[],curtainTags:[],fabricTags:[],furnishingTags:[],chairs:[],hasTelevision:false,hasComputer:false};
it('uses constrained short labels and maps reordered answers back to original image hashes',async()=>{
 const bytes=await sharp({create:{width:2,height:2,channels:3,background:'white'}}).png().toBuffer();
 const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({images:[{...category,imageId:'image_2'},{...category,imageId:'image_1'}]})}]}}]})));
 vi.stubGlobal('fetch',fetchMock);
 try{
  const answers=await classifyStructuredBatch([{id:'original-hash-a',bytes},{id:'original-hash-b',bytes}],'secret','test-model');
  expect(answers.map(a=>a.id)).toEqual(['original-hash-b','original-hash-a']);
  const request=JSON.parse(fetchMock.mock.calls[0]![1].body);
  expect(request.generationConfig.responseJsonSchema.properties.images.items.properties.imageId.enum).toEqual(['image_1','image_2']);
  expect(request.generationConfig.responseJsonSchema.properties.images).not.toHaveProperty('minItems');
  expect(request.generationConfig.responseJsonSchema.properties.images).not.toHaveProperty('maxItems');
  expect(request.contents[0].parts[1].text).toBe('imageId: image_1');
 }finally{vi.unstubAllGlobals();}
});
it('still rejects incomplete batches locally when the API schema omits array bounds',async()=>{
 const bytes=await sharp({create:{width:2,height:2,channels:3,background:'white'}}).png().toBuffer();
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({images:[{...category,imageId:'image_1'}]})}]}}]}))));
 try{await expect(classifyStructuredBatch([{id:'a',bytes},{id:'b',bytes}],'secret','test-model')).rejects.toThrow();}finally{vi.unstubAllGlobals();}
});
it('reports API rejection details without exposing the API key',async()=>{
 const bytes=await sharp({create:{width:2,height:2,channels:3,background:'white'}}).png().toBuffer();
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{message:'Invalid argument secret-key'}}),{status:400})));
 try{await expect(classifyStructuredBatch([{id:'a',bytes}],'secret-key','test-model')).rejects.toMatchObject({status:400,message:'Gemini HTTP 400: Invalid argument [redacted]'});}finally{vi.unstubAllGlobals();}
});
it('rejects duplicate labels so results cannot be assigned to the wrong image',async()=>{
 const bytes=await sharp({create:{width:2,height:2,channels:3,background:'white'}}).png().toBuffer();
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({images:[{...category,imageId:'image_1'},{...category,imageId:'image_1'}]})}]}}]}))));
 try{await expect(classifyStructuredBatch([{id:'a',bytes},{id:'b',bytes}],'secret','test-model')).rejects.toThrow('IDs do not match');}finally{vi.unstubAllGlobals();}
});
