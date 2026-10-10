import {it,expect} from 'vitest';
import {localClassificationStatistics} from '../src/reports/local-classification-statistics';
import type {RunReport} from '../src/reports/report';
import type {PipelineSummary} from '../src/reports/pipeline-summary';
it('derives offline throughput from model timestamps and suppresses stale ETAs',()=>{
 const now=Date.parse('2026-10-09T16:00:00Z');
 const report={images:[{categorisation:{classifiedAt:'2026-10-09T15:30:00Z'}},{categorisation:{classifiedAt:'2026-10-09T12:00:00Z'}},{categorisation:{}},{categorisation:{classifiedAt:'2026-10-07T12:00:00Z'}}]} as RunReport;
 const summary={status:'running',updatedAt:new Date(now).toISOString(),totals:{pending:2,failed:0}} as PipelineSummary;
 const stats=localClassificationStatistics(report,summary,now);
 expect(stats.perHour).toBe(1);expect(stats.completed24h).toBe(2);expect(stats.eta).toBe('2026-10-09T18:00:00.000Z');
 expect(localClassificationStatistics(report,{...summary,updatedAt:'2026-10-09T15:00:00Z'},now).eta).toBeNull();
});
