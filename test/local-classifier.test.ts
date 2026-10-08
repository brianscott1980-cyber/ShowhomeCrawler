import {afterEach,expect,it,vi} from 'vitest';
import sharp from 'sharp';
import {classifyLocal,localSchema} from '../src/vision/local-classifier';
const fields={interiorColours:[],furnishings:[],mainCategory:'Bedroom',subCategory:'Double bedroom',description:'A bedroom',objects:['bed'],colours:['Blue'],decor:['Blue decor'],wallpaperTags:[],curtainTags:[],fabricTags:['Blue bedding'],furnishingTags:[],chairs:[],hasTelevision:false,hasComputer:false};
afterEach(()=>vi.restoreAllMocks());
it('requests structured vision JSON and records local provenance and searchable tags',async()=>{
 const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({done:true,message:{content:JSON.stringify(fields)},eval_count:100})));
 const bytes=await sharp({create:{width:4,height:4,channels:3,background:'#fff'}}).jpeg().toBuffer();
 const result=await classifyLocal(bytes,{model:'qwen3-vl:2b',host:'http://localhost:11434'});
 expect(result.categorisation.categorisationSource).toBe('ollama');expect(result.verdict.matches).toBe(true);expect(result.categorisation.fabricTags).toEqual(['Blue bedding']);
 const request=JSON.parse(fetch.mock.calls[0]![1]!.body as string);expect(request.stream).toBe(false);expect(request.messages[0].images).toHaveLength(1);expect(request.format.properties.mainCategory.enum).toContain('Infographic');
});
it('excludes infographic drawings but permits property exterior renders',async()=>{
 const bytes=await sharp({create:{width:4,height:4,channels:3,background:'#fff'}}).jpeg().toBuffer();
 const fetch=vi.spyOn(globalThis,'fetch');
 for(const category of ['Infographic','Illustration','Exterior']){
  fetch.mockResolvedValue(new Response(JSON.stringify({done:true,message:{content:JSON.stringify({...fields,mainCategory:category})}})));
  const result=await classifyLocal(bytes,{model:'local',host:'http://localhost:11434'});expect(result.categorisation.isRoom).toBe(false);expect(result.verdict.matches).toBe(category==='Exterior');
 }
 expect(()=>localSchema.parse({...fields,mainCategory:'Invented'})).toThrow();
});
