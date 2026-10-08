import type {PipelineSummary} from './pipeline-summary';
export interface ProgressSample {at:string;completed:number;images:number}
export interface PipelineStatistics {observedSince:string;completed24h:number;images24h:number;perHour:number|null;eta:string|null;remaining:number}
const hour=3600000,day=24*hour;
export function progressStatistics(samples:ProgressSample[],summary:PipelineSummary,now=Date.now()):PipelineStatistics{
 let completed24h=0,images24h=0,recent=0,elapsed=0;
 for(let i=1;i<samples.length;i++){
  const a=samples[i-1]!,b=samples[i]!,start=Date.parse(a.at),end=Date.parse(b.at),duration=end-start;
  if(duration<=0||end>now)continue;
  const fraction=(window:number)=>Math.max(0,end-Math.max(start,now-window))/duration;
  completed24h+=Math.max(0,b.completed-a.completed)*fraction(day);
  images24h+=Math.max(0,b.images-a.images)*fraction(day);
  recent+=Math.max(0,b.completed-a.completed)*fraction(hour);
  elapsed+=duration*fraction(hour);
 }
 const perHour=elapsed>=60000&&recent>0?recent/(elapsed/hour):null;
 const remaining=summary.totals.pending+summary.totals.failed;
 const fresh=now-Date.parse(summary.updatedAt)<=120000;
 const eta=summary.status==='running'&&fresh&&perHour&&remaining>0?new Date(now+remaining/perHour*hour).toISOString():null;
 return {observedSince:samples[0]?.at??new Date(now).toISOString(),completed24h:Math.round(completed24h),images24h:Math.round(images24h),perHour,eta,remaining};
}
export function retainSamples(samples:ProgressSample[],sample:ProgressSample){
 if(samples.at(-1)?.at===sample.at)return samples;
 const next=[...samples,sample],cut=Date.parse(sample.at)-day;
 while(next.length>2&&Date.parse(next[1]!.at)<cut)next.shift();
 return next;
}
