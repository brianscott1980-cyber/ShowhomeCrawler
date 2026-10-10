import {it,expect,vi,afterEach} from 'vitest';
const calls=vi.hoisted(()=>({queries:[] as unknown[][],files:[] as string[],end:vi.fn()}));
vi.mock('node:fs/promises',()=>({mkdir:async()=>{},writeFile:async(file:string)=>{calls.files.push(file);},rename:async()=>{},unlink:async()=>{}}));
vi.mock('../src/database/postgres',()=>({createDatabase:()=>Object.assign(async(_strings:TemplateStringsArray,...values:unknown[])=>{calls.queries.push(values);},{json:(v:unknown)=>v,end:calls.end})}));
import {progressReporter} from '../src/reports/pipeline-progress';
import type {RunReport} from '../src/reports/report';
afterEach(()=>{vi.unstubAllEnvs();calls.queries=[];calls.files=[];vi.clearAllMocks();});
it('publishes separate phase keys and keeps frequently changing state out of the tracked checkout',async()=>{
 vi.stubEnv('DATABASE_URL','configured');
 const report={images:[],properties:[],developments:[],metrics:{},startedAt:'2026-10-08T10:00:00Z',crawlProgress:{status:'running',updatedAt:'',currentDevelopments:['First']},classificationProgress:{status:'running',updatedAt:'',currentDevelopments:['Second']}} as unknown as RunReport;
 const crawl=progressReporter('crawl'),classification=progressReporter('classification');
 await crawl.update('alpha',report,true);await classification.update('alpha',report,true);
 expect(calls.queries.map(v=>v[0])).toEqual(['pipeline:crawl:alpha','pipeline:classification:alpha']);
 expect((calls.queries[0]![1] as {currentDevelopments:string[]}).currentDevelopments).toEqual(['First']);
 expect((calls.queries[1]![1] as {currentDevelopments:string[]}).currentDevelopments).toEqual(['Second']);
 expect(calls.files.every(f=>f.startsWith('.showhome/pipeline-progress/'))).toBe(true);
 await crawl.update('alpha',report);expect(calls.queries).toHaveLength(2);
 await crawl.close();await classification.close();expect(calls.end).toHaveBeenCalledTimes(2);
});
