import {z} from 'zod';
import sharp from 'sharp';
import {localPrompt,localSchema,localClassificationVersion} from './local-classifier';
import type {ImageCategorisation} from '../reports/report';
export async function classifyStructuredBatch(items:{id:string;bytes:Buffer}[],apiKey:string,model:string){
 if(!items.length||items.length>8)throw new Error('Use 1–8 images per batch.');
 const labels=items.map((_,index)=>'image_'+(index+1));
 const schema=z.object({images:z.array(localSchema.extend({imageId:z.enum(labels as [string,...string[]])})).min(items.length).max(items.length)});
 // Validate exact cardinality locally; avoid expanding the rich object eight times
 // in Gemini's constrained-decoding schema.
 const responseSchema=z.object({images:z.array(localSchema.extend({imageId:z.enum(labels as [string,...string[]])}))});
 const start=Date.now(),parts:unknown[]=[{text:localPrompt+'\nClassify EVERY labelled image independently. Return each exact imageId once in images.'}];
 for(const [index,item] of items.entries()){const jpeg=await sharp(item.bytes).rotate().resize({width:768,height:768,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toBuffer();parts.push({text:'imageId: '+labels[index]},{inlineData:{mimeType:'image/jpeg',data:jpeg.toString('base64')}});}
 const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',signal:AbortSignal.timeout(60000),headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({contents:[{parts}],generationConfig:{temperature:0,responseMimeType:'application/json',responseJsonSchema:z.toJSONSchema(responseSchema)}})});
 if(!response.ok){
  const errorBody=await response.json().catch(()=>undefined);
  const detail=String(errorBody?.error?.message??'').replaceAll(apiKey,'[redacted]').slice(0,1500);
  throw Object.assign(new Error(`Gemini HTTP ${response.status}${detail?': '+detail:''}`),{status:response.status});
 }
 const body=await response.json(),candidate=body.candidates?.[0];
 if(candidate?.finishReason!=='STOP')throw new Error('Incomplete Gemini batch.');
 const result=schema.parse(JSON.parse(candidate.content.parts.map((p:{text?:string})=>p.text??'').join('')));
 if(new Set(result.images.map(i=>i.imageId)).size!==items.length)throw new Error('Gemini batch IDs do not match.');
 return result.images.map(({imageId,...category})=>{
  const isRoom=!['Exterior','Floorplan','Infographic','Illustration','Other'].includes(category.mainCategory);
  const categorisation:ImageCategorisation={...category,isRoom,classifiedAt:new Date().toISOString(),classificationStatus:'completed',processingMs:Date.now()-start,categorisationSource:'gemini',categorisationModel:model,categorisationVersion:localClassificationVersion,wallpaper:category.wallpaperTags.join(' · ')||null,curtains:category.curtainTags.join(' · ')||null};
  return {id:items[labels.indexOf(imageId)]!.id,categorisation,verdict:{matches:isRoom||category.mainCategory==='Exterior',hasDesk:category.objects.some(o=>/\bdesk\b/i.test(o)),hasBed:category.objects.some(o=>/\bbed|cot|crib/i.test(o)),hasFloorplan:category.mainCategory==='Floorplan',roomType:category.mainCategory,description:category.description,reason:'Gemini vision classification'}};
 });
}
