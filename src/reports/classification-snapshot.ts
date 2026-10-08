import type {RunReport} from './report';
export function classificationSnapshot(builder:string,report:RunReport,development:string,publication:string){
 const images=new Map(report.images.map(i=>[i.id,i]));
 const groups=report.properties.map(home=>{const linked=home.imageIds.map(id=>images.get(id)).filter(i=>!!i);return {development:home.development,buildingType:home.name,completed:linked.filter(i=>!!i.categorisation).length,failed:linked.filter(i=>!i.categorisation&&!!i.error).length,pending:linked.filter(i=>!i.categorisation&&!i.error).length};});
 return {builder,updatedAt:new Date().toISOString(),publication,development,groups,images:report.images.map(i=>({id:i.id,path:i.path,categorisation:i.categorisation,model:i.analysisModel,error:i.error}))};
}
