import {it,expect} from 'vitest';
import {pipelineSummary} from '../src/reports/pipeline-summary';
import type {RunReport,ImageCategorisation} from '../src/reports/report';
const report=()=>({builder:{slug:'alpha',name:'Alpha',websiteUrl:''},status:'completed_with_gaps',startedAt:'2026-10-08T10:00:00Z',model:'old',question:'All images',metrics:{},errors:[],developments:[{url:'a',name:'First',status:'complete',qualifying:2},{url:'b',name:'Second',status:'complete',qualifying:1}],properties:[{url:'h1',developmentUrl:'a',development:'First',name:'House',imageIds:['1','2']},{url:'h2',developmentUrl:'a',development:'First',name:'Other',imageIds:['1']},{url:'h3',developmentUrl:'b',development:'Second',name:'House',imageIds:['1']}],images:[{id:'1',categorisation:{mainCategory:'Kitchen'} as ImageCategorisation},{id:'2',error:'Classification not requested'}]} as unknown as RunReport);
it('counts shared images once and keeps historical crawl completion unconfirmed',()=>{
 const r=report(),c=pipelineSummary('alpha',r,'crawl'),i=pipelineSummary('alpha',r,'classification');
 expect(c.status).toBe('recorded');expect(c.currentDevelopments).toEqual([]);
 expect(c.totals.completed).toBe(3);expect(c.developments.every(d=>d.status==='recorded')).toBe(true);
 expect(i.totals.completed).toBe(1);expect(i.totals.pending).toBe(1);expect(i.totals.failed).toBe(0);
 expect(i.developments[0]?.total).toBe(2);expect(i.developments[1]?.total).toBe(1);
});
it('reports independent current developments and never treats discovery as gallery completion',()=>{
 const r=report();r.crawlProgress={status:'running',updatedAt:'2026-10-08T11:00:00Z',currentDevelopments:['Second'],galleries:{h1:'completed',h2:'failed',h3:'running'}};
 r.classificationProgress={status:'running',updatedAt:'2026-10-08T11:01:00Z',currentDevelopments:['First'],model:'local'};
 const c=pipelineSummary('alpha',r,'crawl'),i=pipelineSummary('alpha',r,'classification');
 expect(c.currentDevelopments).toEqual(['Second']);expect(i.currentDevelopments).toEqual(['First']);
 expect(c.totals.completed).toBe(1);expect(c.totals.failed).toBe(1);expect(c.totals.pending).toBe(1);
 expect(i.totals.failed).toBe(0);
 r.images[1]!.error='Local model output invalid';
 expect(pipelineSummary('alpha',r,'classification').totals.failed).toBe(1);
});
