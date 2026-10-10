import type {RunReport} from './report';
import type {PipelineSummary} from './pipeline-summary';
import type {PipelineStatistics} from './pipeline-statistics';
/** Saved model timestamps provide throughput without a database or restarted worker. */
export function localClassificationStatistics(report:RunReport,summary:PipelineSummary,now=Date.now()):PipelineStatistics{
 const times=report.images.filter(image=>image.categorisation).map(image=>Date.parse(image.categorisation?.classifiedAt??'')).filter(time=>Number.isFinite(time)&&time<=now);
 const completed24h=times.filter(time=>time>=now-86400000).length;
 const recent=times.filter(time=>time>=now-3600000).length;
 const perHour=recent||null,remaining=summary.totals.pending+summary.totals.failed;
 const fresh=now-Date.parse(summary.updatedAt)<=120000;
 const eta=summary.status==='running'&&fresh&&perHour&&remaining?new Date(now+remaining/perHour*3600000).toISOString():null;
 return {observedSince:times.length?new Date(Math.min(...times)).toISOString():new Date(now).toISOString(),completed24h,images24h:0,perHour,eta,remaining};
}
