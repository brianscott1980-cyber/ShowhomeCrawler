import {z} from 'zod';
import sharp from 'sharp';
import type {ImageCategorisation} from '../reports/report.js';
import type {Verdict} from './gemini-classifier.js';
export const localClassificationVersion='local-interiors-v1';
export const localSchema=z.object({
 mainCategory:z.enum(['Living Room','Dining Room','Kitchen','Bedroom','Bathroom','Toilet','Study & Home Office','Hallway','Exterior','Utility Room','Dressing Room','Home Gym','Media & Games Room','Conservatory','Floorplan','Infographic','Illustration','Empty','Other']),
 subCategory:z.string(),description:z.string(),objects:z.array(z.string()),colours:z.array(z.string()),decor:z.array(z.string()),wallpaperTags:z.array(z.string()),curtainTags:z.array(z.string()),fabricTags:z.array(z.string()),furnishingTags:z.array(z.string()),chairs:z.array(z.string()),hasTelevision:z.boolean(),hasComputer:z.boolean()
});
export const localPrompt=`Classify only the supplied property image. Return the requested JSON, with short specific tags and a brief factual description. Do not invent hidden features, brands or materials.
Use the room function as mainCategory; Exterior includes photorealistic architectural CGI. Floorplan, Infographic and Illustration are non-room graphics; a drawing of a room is Illustration, but a photorealistic architectural render is not. Unknown is Other.
Bedrooms: subCategory Double bedroom for double/queen/king beds or two sleeping pillows side by side at the head of ONE bed for two people. Stacked pillows and decorative cushions alone do not prove bed size. Single/twin/bunk beds are Single bedroom, cot-only rooms Nursery; otherwise Bedroom (bed size unclear). Empty/unfurnished rooms: subCategory Empty; mainCategory Empty only when function is unknown.
Record plain object types in objects and colours independently in colours. If an accent colour repeats across multiple distinct cushions, ornaments, tablecloths or accent walls, put Blue decor (or its actual colour) in decor. One item does not establish a decor theme.
wallpaperTags: separate pattern, feature use and colour, e.g. Geometric wallpaper, Floral wallpaper, Jungle wallpaper, Feature wallpaper, Blue wallpaper. Painted walls/paneling are not wallpaper.
curtainTags: separate pattern and colour, e.g. Floral curtains, Green curtains. fabricTags: object-specific pattern and colour, e.g. Striped bedding, Blue bedding, Floral cushions, Green cushions.
furnishingTags: separate object-specific colour, material/texture, shape and style, e.g. Gold lamp, Geometric lamp, Round mirror, Brass mirror, Bouclé armchair, Marble table. Cover visible tables, lamps, mirrors, seating, rugs, headboards, cabinets and ornaments. Empty arrays when absent or uncertain. Only mark TV/computer when visible.`;
export async function classifyLocal(bytes:Buffer,{model,host,timeoutMs=300000}:{model:string;host:string;timeoutMs?:number}){
 const image=await sharp(bytes).rotate().resize({width:768,height:768,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toBuffer();
 const start=performance.now();
 const response=await fetch(`${host.replace(/\/$/,'')}/api/chat`,{method:'POST',signal:AbortSignal.timeout(timeoutMs),headers:{'Content-Type':'application/json'},body:JSON.stringify({model,stream:false,keep_alive:'5m',format:z.toJSONSchema(localSchema),messages:[{role:'user',content:localPrompt,images:[image.toString('base64')]}],options:{temperature:0,num_ctx:4096,num_predict:1200}})});
 if(!response.ok)throw new Error(`Local model HTTP ${response.status}; run npm run ai:local:setup first.`);
 const body=await response.json() as {done?:boolean;done_reason?:string;message?:{content?:string};eval_count?:number;total_duration?:number};
 if(!body.done||body.done_reason==='length')throw new Error('Local model output incomplete; classification was not saved.');
 if(!body.message?.content?.trim())throw new Error('Local model returned an empty answer; use an explicit instruct model such as qwen3-vl:8b-instruct.');
 let result:z.infer<typeof localSchema>;
 try{result=localSchema.parse(JSON.parse((body.message?.content??'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')));}catch(error){throw new Error('Local model output invalid: '+(error instanceof z.ZodError?error.issues.map(issue=>issue.path.join('.')+': '+issue.message).join('; '):'Expected complete JSON; response starts '+JSON.stringify(body.message?.content?.slice(0,160))));}
 const isRoom=!['Exterior','Floorplan','Infographic','Illustration','Other'].includes(result.mainCategory);
 const categorisation:ImageCategorisation={...result,categorisationSource:'ollama',categorisationModel:model,categorisationVersion:localClassificationVersion,isRoom,wallpaper:result.wallpaperTags.join(' · ')||null,curtains:result.curtainTags.join(' · ')||null};
 const verdict:Verdict={matches:isRoom||result.mainCategory==='Exterior',roomType:result.mainCategory,description:result.description,reason:'Local vision classification',hasDesk:result.objects.some(item=>/\bdesk\b/i.test(item)),hasBed:result.objects.some(item=>/\bbed|cot|crib/i.test(item)),hasFloorplan:result.mainCategory==='Floorplan'};
 return {categorisation,verdict,elapsedMs:Math.round(performance.now()-start),outputTokens:body.eval_count??0};
}
