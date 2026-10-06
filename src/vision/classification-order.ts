import type {RunReport,ReportImage} from '../reports/report.js';
import {homeTypeName} from '../reports/home-display.js';
/** Walk the builder's development/house-type hierarchy, not image download order. */
export function classificationOrder(report:RunReport,priorityDevelopment?:string){
 const homes=[...report.properties].sort((a,b)=>{
  const priority=(name:string)=>priorityDevelopment&&name.toLowerCase().includes(priorityDevelopment.toLowerCase())?0:1;
  return priority(a.development)-priority(b.development)||a.development.localeCompare(b.development,'en',{numeric:true})||a.developmentUrl.localeCompare(b.developmentUrl)||homeTypeName(a.name).localeCompare(homeTypeName(b.name),'en',{numeric:true});
 });
 const order=new Map<string,{rank:number;group:string}>();
 for(const [rank,home] of homes.entries())for(const id of home.imageIds)if(!order.has(id))order.set(id,{rank,group:JSON.stringify([home.developmentUrl,homeTypeName(home.name).toLowerCase()])});
 return {images:[...report.images].sort((a,b)=>(order.get(a.id)?.rank??Infinity)-(order.get(b.id)?.rank??Infinity)||a.id.localeCompare(b.id)),group:(image:ReportImage)=>order.get(image.id)?.group??'unlinked'};
}
/** A request never mixes house types; shared images belong to their first type. */
export function classificationBatches(report:RunReport,images:ReportImage[],size=8,priorityDevelopment?:string){
 const order=classificationOrder(report,priorityDevelopment),pending=new Set(images.map(image=>image.id)),batches:ReportImage[][]=[];
 let previous='';
 for(const image of order.images){if(!pending.has(image.id))continue;const group=order.group(image),last=batches.at(-1);if(last&&last.length<size&&group===previous)last.push(image);else batches.push([image]);previous=group;}
 return batches;
}
