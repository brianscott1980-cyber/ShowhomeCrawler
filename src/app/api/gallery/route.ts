import {z} from 'zod';
import {cachedGallery as queryGallery} from '../../../database/gallery-cache';
const schema=z.object({imageOnly:z.boolean().optional(),scope:z.object({kind:z.enum(['buildings','interiors','favourites']),href:z.string().max(500),fixedFilters:z.object({colour:z.string().max(3000).optional()}).optional()}),filters:z.record(z.string(),z.string().max(3000)).optional(),favourites:z.array(z.string().max(100)).max(5000).optional(),selectedUid:z.string().max(200).optional(),offset:z.number().int().min(0).max(100000).optional(),limit:z.number().int().min(1).max(64).optional()});
export async function POST(request:Request){
 let body:unknown;try{const text=await request.text();if(text.length>600000)return Response.json({error:'Request too large'},{status:413});body=JSON.parse(text);}catch{return Response.json({error:'Invalid gallery criteria'},{status:400});}
 const parsed=schema.safeParse(body);if(!parsed.success)return Response.json({error:'Invalid gallery criteria'},{status:400});
 for(const key of ['minBeds','maxBeds','minPrice','maxPrice']){const value=parsed.data.filters?.[key];if(value&&(!Number.isFinite(Number(value))||Number(value)<0))return Response.json({error:'Invalid numeric criteria'},{status:400});}
 try{return Response.json(await queryGallery(parsed.data),{headers:{'Cache-Control':'private, no-store'}});}catch{return Response.json({error:'Unable to load gallery. Please try again.'},{status:503});}
}
