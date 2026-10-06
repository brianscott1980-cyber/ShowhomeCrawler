import {expect,it} from 'vitest';
import {classificationOrder,classificationBatches} from '../src/vision/classification-order';
import type {RunReport} from '../src/reports/report';
const report={properties:[{development:'Zed',developmentUrl:'/z',name:'House A',imageIds:['z','shared']},{development:'Alpha',developmentUrl:'/a',name:'House B',imageIds:['b','shared']},{development:'Alpha',developmentUrl:'/a',name:'House A',imageIds:['a1','a2']}],images:['z','b','a2','shared','a1','orphan'].map(id=>({id}))} as RunReport;
it('orders by development then house type regardless of image download order',()=>{
 expect(classificationOrder(report).images.map(image=>image.id)).toEqual(['a1','a2','b','shared','z','orphan']);
 const batches=classificationBatches(report,report.images);
 expect(batches.map(batch=>batch.map(image=>image.id))).toEqual([['a1','a2'],['b','shared'],['z'],['orphan']]);
 expect(batches.flat().filter(image=>image.id==='shared')).toHaveLength(1);
});
it('keeps explicit development priority and batch limits without mixing types',()=>{
 expect(classificationBatches(report,report.images,1,'zed').flat().map(image=>image.id)).toEqual(['shared','z','a1','a2','b','orphan']);
 expect(classificationBatches(report,report.images.filter(image=>image.id!=='a1'),8).map(batch=>batch.map(image=>image.id))).toEqual([['a2'],['b','shared'],['z'],['orphan']]);
});
