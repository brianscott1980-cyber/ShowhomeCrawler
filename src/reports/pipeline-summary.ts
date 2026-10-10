import type {PipelineStatistics} from './pipeline-statistics';
import type {RunReport} from './report';
export type PipelinePhase='crawl'|'classification';
export interface CrawlStage {label:string;completed?:number;total?:number;unit?:string}
export interface PipelineActivity {stage?:CrawlStage;status:'running'|'completed'|'stopped'|'failed';updatedAt:string;currentDevelopments:string[];model?:string;galleries?:Record<string,'running'|'completed'|'failed'>}
export interface PipelineSummary {
 stage?:CrawlStage;
 workers?:{id:string;model:string;status:string;updatedAt:string;currentDevelopments:string[];statistics?:PipelineStatistics}[];
 statistics?:PipelineStatistics;phase:PipelinePhase;builder:string;builderName:string;status:PipelineActivity['status']|'recorded';updatedAt:string;currentDevelopments:string[];
 totals:{completed:number;failed:number;pending:number;total:number;images:number;developments:number;developmentsCompleted:number;structuredImages:number};
 models:{name:string;count:number}[];
 developments:{url:string;name:string;status:string;completed:number;failed:number;pending:number;total:number;images:number}[];
}
const classificationFailed=(image:RunReport['images'][number])=>!image.categorisation&&!!image.error&&!/^(Classification not requested|Classifier unavailable after earlier API error)$/.test(image.error);
export function pipelineSummary(builder:string,report:RunReport,phase:PipelinePhase):PipelineSummary {
 const activity=phase==='crawl'?report.crawlProgress:report.classificationProgress;
 const imageMap=new Map(report.images.map(i=>[i.id,i]));
 const developments=new Map((report.developments??[]).map(d=>[d.url,{url:d.url,name:d.name??d.url,expected:d.qualifying??d.homes??0,discoveryStatus:d.status}]));
 for(const home of report.properties)if(!developments.has(home.developmentUrl))developments.set(home.developmentUrl,{url:home.developmentUrl,name:home.development,expected:0,discoveryStatus:'recorded'});
 const rows=[...developments.values()].map(d=>{
  const homes=report.properties.filter(h=>h.developmentUrl===d.url);
  const images=[...new Set(homes.flatMap(h=>h.imageIds))].map(id=>imageMap.get(id)).filter(i=>!!i);
  const total=phase==='crawl'?Math.max(d.expected,homes.length):images.length;
  const completed=phase==='crawl'?homes.filter(h=>activity?.galleries?activity.galleries[h.url]==='completed':h.imageIds.length>0).length:images.filter(i=>!!i.categorisation).length;
  const failed=phase==='crawl'?homes.filter(h=>activity?.galleries?.[h.url]==='failed').length:images.filter(classificationFailed).length;
  const pending=Math.max(0,total-completed-failed);
  const active=activity?.status==='running'&&activity.currentDevelopments.includes(d.name);
  const status=active?'running':phase==='crawl'&&d.discoveryStatus==='failed'?'failed':failed?'needs attention':!total?(phase==='classification'?'waiting for images':'no galleries recorded'):phase==='crawl'&&!activity?'recorded':!pending?'completed':'pending';
  return {url:d.url,name:d.name,status,completed,failed,pending,total,images:images.length};
 }).sort((a,b)=>a.name.localeCompare(b.name,'en',{numeric:true}));
 const completed=phase==='classification'?report.images.filter(i=>!!i.categorisation).length:rows.reduce((sum,d)=>sum+d.completed,0);
 const failed=phase==='classification'?report.images.filter(classificationFailed).length:rows.reduce((sum,d)=>sum+d.failed,0)+(report.developments??[]).filter(d=>d.status==='failed').length;
 const total=phase==='classification'?report.images.length:rows.reduce((sum,d)=>sum+d.total,0);
 const models=new Map<string,number>();
 if(phase==='classification')for(const image of report.images){if(!image.categorisation)continue;const name=image.categorisation.categorisationModel??image.analysisModel??image.categorisation.categorisationSource??'Not recorded';models.set(name,(models.get(name)??0)+1);}
 return {stage:activity?.stage,phase,builder,builderName:report.builder?.name??builder,status:activity?.status??'recorded',updatedAt:activity?.updatedAt??report.completedAt??report.startedAt,currentDevelopments:activity?.status==='running'?activity.currentDevelopments:[],totals:{completed,failed,pending:Math.max(0,total-completed-(phase==='crawl'?rows.reduce((sum,d)=>sum+d.failed,0):failed)),total,images:report.images.length,developments:Math.max(rows.length,phase==='crawl'?report.metrics?.selectedDevelopments??0:rows.length),developmentsCompleted:rows.filter(d=>d.status==='completed').length,structuredImages:report.images.filter(i=>!!i.categorisation?.interiorColours&&!!i.categorisation?.furnishings).length},models:[...models].map(([name,count])=>({name,count})),developments:rows};
}
