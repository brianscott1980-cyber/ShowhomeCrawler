import {expect,it} from 'vitest';
import {overviewCollection} from '../src/web/overview-payload';
import type {Collection} from '../src/web/groups';
it('sends a bounded diverse overview while retaining original catalogue data',()=>{
 const images=Array.from({length:100},(_,i)=>({id:String(i),path:`images/${i}.jpg`,sourceUrl:'https://example.com/image.jpg',verdict:{matches:true,description:'Room'},categorisation:{mainCategory:i===99?'Exterior':'Bedroom',subCategory:'Room',isRoom:i!==99,colours:[],chairs:[],objects:[],hasTelevision:false,hasComputer:false}}));
 const collection={slug:'test',name:'Test',report:{status:'completed',startedAt:'now',model:'test',question:'test',developments:[],errors:[],metrics:{},images,properties:[{name:'House',url:'https://example.com/home',development:'Development',developmentUrl:'https://example.com/development',bedrooms:3,price:250000,plots:[],imageIds:images.map(i=>i.id)}]}} as Collection;
 const preview=overviewCollection(collection);
 expect(preview.report.images).toHaveLength(24);
 expect(preview.report.images.some(i=>i.categorisation?.mainCategory==='Exterior')).toBe(true);
 expect(preview.report.properties[0]?.imageIds).toHaveLength(24);
 expect(collection.report.images).toHaveLength(100);
 expect(collection.report.properties[0]?.imageIds).toHaveLength(100);
});
