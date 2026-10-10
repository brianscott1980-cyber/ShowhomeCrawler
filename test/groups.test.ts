import {expect,it} from 'vitest';
import {groupCollections,spaceName,type Collection} from '../src/web/groups';
const collection=(slug:string):Collection=>({slug,name:slug,report:{status:'completed',startedAt:'now',model:'test',question:'Home office with no beds',developments:[],errors:[],metrics:{},images:[{id:'office',path:'images/office.jpg',sourceUrl:'https://example.com',verdict:{matches:true,hasDesk:true,hasBed:false,roomType:'living room',description:'Desk',reason:'Desk'}},{id:'pending',path:'images/pending.jpg',sourceUrl:'https://example.com'},{id:'rejected',path:'images/rejected.jpg',sourceUrl:'https://example.com',verdict:{matches:false,hasDesk:false,hasBed:true,roomType:'bedroom',description:'Bed',reason:'Bed'}}],properties:[{name:'Sunningdale · Plot 1',development:'Test site',developmentUrl:'https://example.com/'+slug,url:'https://example.com/plot1',bedrooms:5,price:null,plots:[],imageIds:['office','pending']},{name:'Sunningdale · Plot 2',development:'Test site',developmentUrl:'https://example.com/'+slug,url:'https://example.com/plot2',bedrooms:5,price:null,plots:[],imageIds:['office']},{name:'Empty type',development:'Empty site',developmentUrl:'https://example.com/empty',url:'https://example.com/empty-home',bedrooms:5,price:null,plots:[],imageIds:['rejected']}]}});
it('groups house types without plot suffixes and deduplicates shared plot images',()=>{const groups=groupCollections([collection('one')],'buildings');expect(groups).toHaveLength(1);expect(groups[0]).toMatchObject({name:'Sunningdale',count:2});expect(groups[0]?.collections[0]?.report.properties).toHaveLength(2);});
it('keeps same-named sites and building types from different developers separate',()=>{for(const kind of ['sites','buildings'] as const){const groups=groupCollections([collection('one'),collection('two')],kind);expect(groups).toHaveLength(2);expect(new Set(groups.map(g=>g.key)).size).toBe(2);}});
it('combines office spaces across developers and hides unclassified images',()=>{const groups=groupCollections([collection('one'),collection('two')],'spaces');expect(groups.map(g=>[g.name,g.count])).toEqual([['Study & Home Office',2]]);expect(spaceName(collection('one').report.images[1]!)).toBe('Uncategorised');expect(spaceName(collection('one').report.images[2]!)).toBe('Uncategorised');});
it('uses stable detail keys across successive crawls',()=>{const a=collection('one'),b=collection('one');b.report.properties.reverse();expect(groupCollections([a],'buildings')[0]?.key).toBe(groupCollections([b],'buildings')[0]?.key);});
it('groups categorised images by their mainCategory and excludes uncategorised images',()=>{
 const col:Collection={slug:'cat-test',name:'Cat Test',report:{status:'completed',startedAt:'now',model:'test',question:'Test',developments:[],errors:[],metrics:{},images:[
  {id:'img1',path:'images/1.jpg',sourceUrl:'https://example.com/1',categorisation:{mainCategory:'Bedroom',subCategory:'Master bedroom',isRoom:true,objects:['bed'],colours:['Blue'],chairs:[],hasTelevision:false,hasComputer:false}},
  {id:'img2',path:'images/2.jpg',sourceUrl:'https://example.com/2',categorisation:{mainCategory:'Living Room',subCategory:'Formal lounge',isRoom:true,objects:['sofa'],colours:['Grey'],chairs:['Armchair'],hasTelevision:true,hasComputer:false}},
  {id:'img3',path:'images/3.jpg',sourceUrl:'https://example.com/3',categorisation:{mainCategory:'Other',subCategory:'Empty room',isRoom:true,objects:[],colours:[],chairs:[],hasTelevision:false,hasComputer:false}},
  {id:'img4',path:'images/4.jpg',sourceUrl:'https://example.com/4',categorisation:{mainCategory:'Other',subCategory:'Document / Graphic',isRoom:false,objects:[],colours:[],chairs:[],hasTelevision:false,hasComputer:false}},
  {id:'img5',path:'images/5.jpg',sourceUrl:'https://example.com/5',verdict:{matches:false,roomType:'infographic',description:'Travel infographic',reason:'This is an infographic, not a room.'}},
  {id:'img6',path:'images/6.jpg',sourceUrl:'https://example.com/6',verdict:{matches:false,roomType:'',description:'Unfurnished room with wooden floorboards'}}
 ],properties:[{name:'Style A',development:'Site A',developmentUrl:'https://example.com/site-a',url:'https://example.com/home-a',bedrooms:4,price:null,plots:[],imageIds:['img1','img2','img3','img4','img5','img6']}]}};
 const groups=groupCollections([col],'interiors');
 // Images without a named category, and infographics, are excluded.
 expect(groups.map(g=>[g.name,g.count])).toEqual([['Bedroom',1],['Living Room',1]]);
 for(const kind of ['locations','buildings'] as const){const cards=groupCollections([col],kind);expect(cards).toHaveLength(1);expect(cards[0]?.collections[0]?.report.images.map(i=>i.id)).toEqual(['img1','img2','img3']);}
 expect(spaceName(col.report.images[0]!)).toBe('Bedroom');
 expect(spaceName(col.report.images[1]!)).toBe('Living Room');
 expect(spaceName(col.report.images[2]!)).toBe('Uncategorised');
});



it('retains named types with repeated plot suffixes and type variants',()=>{
 const col=collection('one');col.report.properties[0]!.name='Bantry · Plot 11 · Plot 11';col.report.properties[1]!.name='The Laverick - Type 3 · Plot 2';
 expect(groupCollections([col],'buildings').map(group=>group.name)).toEqual(['Bantry','The Laverick - Type 3']);
});
