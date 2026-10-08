import {expect,it} from 'vitest';
import {progressStatistics,retainSamples} from '../src/reports/pipeline-statistics';
import type {PipelineSummary} from '../src/reports/pipeline-summary';
const now=Date.parse('2026-10-08T21:00:00Z'),at=(offset:number)=>new Date(now+offset).toISOString();
const summary={status:'running',updatedAt:at(0),totals:{pending:120,failed:0}} as PipelineSummary;
it('counts only observed increases and estimates remaining builder work from recent throughput',()=>{
 const result=progressStatistics([{at:at(-3600000),completed:100,images:200},{at:at(0),completed:160,images:300}],summary,now);
 expect(result.completed24h).toBe(60);expect(result.images24h).toBe(100);expect(result.perHour).toBe(60);expect(result.eta).toBe(at(7200000));
});
it('does not invent throughput from historical catalogue counts or show stale ETAs',()=>{
 expect(progressStatistics([{at:at(0),completed:1000,images:2000}],summary,now).completed24h).toBe(0);
 expect(progressStatistics([{at:at(0),completed:1000,images:2000}],summary,now).eta).toBeNull();
 expect(progressStatistics([{at:at(-3600000),completed:100,images:200},{at:at(0),completed:160,images:300}],{...summary,updatedAt:at(-180000)},now).eta).toBeNull();
});
it('retains an anchor across the 24-hour boundary and ignores counter resets',()=>{
 const samples=[{at:at(-90000000),completed:100,images:100},{at:at(-86400000),completed:200,images:200},{at:at(-3600000),completed:10,images:10}];
 const kept=retainSamples(samples,{at:at(0),completed:20,images:30});
 expect(kept).toHaveLength(4);expect(progressStatistics(kept,summary,now).completed24h).toBe(10);
});
