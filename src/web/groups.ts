import {createHash} from 'node:crypto';
import {developers,readCollection} from './collections';
import {homeTypeName} from '../reports/home-display';
import type {RunReport,ReportImage} from '../reports/report';
export type GroupKind='sites'|'spaces'|'buildings'|'locations'|'interiors';
export interface Collection {slug:string;name:string;report:RunReport}
export interface Group {key:string;name:string;developers:string[];collections:Collection[];count:number}
const keyFor=(value:string)=>createHash('sha256').update(value).digest('hex').slice(0,20);
export function spaceName(image:ReportImage,question?:string){
 if(!image.verdict)return 'Uncategorised';
 if(question&&/home office/i.test(question))return 'Study & Home Office';
 const room=image.verdict.roomType?.trim();
 if(!room||/office|study/i.test(room))return 'Study & Home Office';
 return room.replace(/[_-]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}
export function groupCollections(collections:Collection[],kind:GroupKind):Group[]{
 const groups=new Map<string,Group>();
 const isSpaces=kind==='spaces'||kind==='interiors';
 const isSites=kind==='sites'||kind==='locations';
 for(const collection of collections){
  const maps=new Map<string,{name:string;images:ReportImage[];properties:RunReport['properties']}>();
  for(const image of collection.report.images.filter(i=>!i.verdict||i.verdict.matches)){
   const homes=(collection.report.properties??[]).filter(p=>p.imageIds.includes(image.id));
   const entries=isSpaces?[{identity:spaceName(image,collection.report.question),name:spaceName(image,collection.report.question),homes}]:homes.map(p=>({identity:isSites?`${collection.slug}:${p.developmentUrl}`:`${collection.slug}:${homeTypeName(p.name).toLowerCase()}`,name:isSites?p.development:homeTypeName(p.name),homes:[p]}));
   for(const entry of entries){let item=maps.get(entry.identity);if(!item){item={name:entry.name,images:[],properties:[]};maps.set(entry.identity,item);}if(!item.images.some(i=>i.id===image.id))item.images.push(image);for(const home of entry.homes)if(!item.properties.includes(home))item.properties.push(home);}
  }
  for(const [identity,item] of maps){const key=keyFor(identity);let group=groups.get(key);if(!group){group={key,name:item.name,developers:[],collections:[],count:0};groups.set(key,group);}group.developers.push(collection.name);group.count+=item.images.length;group.collections.push({...collection,report:{...collection.report,images:item.images,properties:item.properties}});}
 }
 return [...groups.values()].filter(g=>g.count>0).sort((a,b)=>a.name.localeCompare(b.name)||a.developers.join().localeCompare(b.developers.join()));
}
export async function readGroups(kind:GroupKind){const collections=(await Promise.all(developers.map(async d=>{const report=await readCollection(d.slug);return report?{slug:d.slug,name:d.name,report}:null;}))).filter(c=>c!==null);return groupCollections(collections,kind);}
