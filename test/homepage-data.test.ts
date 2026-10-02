import { expect, it, vi } from 'vitest';
import type { RunReport } from '../src/reports/report';
const fixture=(slug:string):RunReport=>({status:'completed',startedAt:'now',model:'test',question:'test',developments:[],errors:[],metrics:{},properties:[{development:slug,developmentUrl:'https://example.com/'+slug,name:'The Example',url:'https://example.com/'+slug+'/home',bedrooms:5,price:null,plots:[],imageIds:[slug]}],images:[{id:slug,path:'interior.jpg',sourceUrl:'https://example.com/image',verdict:{matches:true,description:'Living room'},categorisation:{mainCategory:'Living Room',subCategory:'Formal lounge',isRoom:true,colours:[],chairs:[],objects:[],hasTelevision:false,hasComputer:false}}]});
vi.mock('../src/web/collections',()=>({developers:[{slug:'mapped',name:'Mapped'},{slug:'unmapped',name:'Unmapped'}],readCollection:async(slug:string)=>fixture(slug),collectionFolder:(slug:string)=>slug,assetUrl:(slug:string,path:string)=>`/api/assets/${slug}/${path}`}));
vi.mock('node:fs/promises',()=>({readFile:async(path:string)=>JSON.stringify(path.startsWith('mapped/')?[{name:'Mapped',url:'https://example.com/mapped',latitude:52,longitude:-1},{name:'Unpublished',url:'https://example.com/extra',latitude:53,longitude:-2}]:[{name:'Unmapped',url:'https://example.com/unmapped',latitude:null,longitude:null}])}));
import { homepageData } from '../src/web/homepage-data';
it('counts published directory entries and maps only entries with valid matching coordinates',async()=>{
 const data=await homepageData();expect(data.counts).toEqual({locations:2,buildings:2,builders:2});expect(data.points).toEqual([{latitude:52,longitude:-1,name:'mapped',builder:'Mapped'}]);expect(data.featured.flatMap(c=>c.report.images)).toHaveLength(2);expect(data.hero?.src).toContain('/api/assets/');
});
