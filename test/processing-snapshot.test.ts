import {expect,it,vi} from 'vitest';
import {resolve} from 'node:path';
const files=vi.hoisted(()=>new Map<string,string>());
vi.mock('node:fs/promises',()=>({readFile:vi.fn(async(path:string)=>{if(!files.has(path))throw new Error('missing');return files.get(path);})}));
import {classificationSnapshot} from '../src/cli/processing-snapshot';
it('adds imported images and links while preserving newer local classifications',async()=>{
 files.clear();
 const base={status:'completed',startedAt:'2026-10-08',developments:[],errors:[],metrics:{}};
 files.set(resolve('results/example-home-offices/results.json'),JSON.stringify({...base,images:[{id:'old',categorisation:{mainCategory:'Bedroom'}}],properties:[{url:'home',imageIds:['old']}]}));
 files.set(resolve('.showhome/imported-reports/example/results.json'),JSON.stringify({...base,images:[{id:'old',categorisation:{mainCategory:'Kitchen'}},{id:'imported',categorisation:{mainCategory:'Bathroom'}}],properties:[{url:'home',imageIds:['imported']}]}));
 const result=await classificationSnapshot('example','results/example-home-offices');
 expect(result?.images.map(i=>i.id)).toEqual(['old','imported']);
 expect(result?.images[0]?.categorisation?.mainCategory).toBe('Bedroom');
 expect(result?.properties[0]?.imageIds).toEqual(['old','imported']);
 files.clear();
});
it('offers incoming crawl images while retaining classifications and published gallery links',async()=>{
 const base={status:'running',startedAt:'2026-10-08',developments:[],errors:[],metrics:{}};
 files.set(resolve('collections','bellway-home-offices','results.json'),JSON.stringify({...base,images:[{id:'old',categorisation:{mainCategory:'Interior'}}],properties:[{url:'home',imageIds:['old']}]}));
 files.set(resolve('results/bellway-home-offices','checkpoint.json'),JSON.stringify({...base,images:[{id:'old'},{id:'new'}],properties:[{url:'home',imageIds:['new']}]}));
 const snapshot=await classificationSnapshot('bellway','results/bellway-home-offices');
 expect(snapshot?.images[0]?.categorisation?.mainCategory).toBe('Interior');
 expect(snapshot?.images.filter(image=>!image.categorisation).map(image=>image.id)).toEqual(['new']);
 expect(snapshot?.properties[0]?.imageIds).toEqual(['old','new']);
});
