import {z} from 'zod';
import {cachedDirectory as queryDirectory} from '../../../database/directory-cache';
const input=z.object({kind:z.enum(['builders','locations','buildings','interiors']),fixedFilters:z.object({developer:z.string().max(200).optional()}).optional(),filters:z.record(z.string(),z.string().max(3000)).default({}),point:z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180)}).nullable().optional(),offset:z.number().int().min(0).max(10000).default(0),limit:z.number().int().min(1).max(64).default(16),selectedKey:z.string().max(100).optional(),keys:z.array(z.string().max(100)).max(3000).optional()});
export async function POST(request:Request){
 try{
  const text=await request.text();if(text.length>100000)return Response.json({error:'Request too large'},{status:413});
  let body:unknown;try{body=JSON.parse(text);}catch{return Response.json({error:'Invalid directory criteria'},{status:400});}
  const parsed=input.safeParse(body);if(!parsed.success)return Response.json({error:'Invalid directory criteria'},{status:400});
  for(const key of ['minBeds','maxBeds','minPrice','maxPrice','radius']){const value=parsed.data.filters[key];if(value&&value!=='any'&&(!Number.isFinite(Number(value))||Number(value)<0))return Response.json({error:'Invalid numeric criteria'},{status:400});}
  return Response.json(await queryDirectory(parsed.data),{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({error:'Unable to load results. Please try again.'},{status:503});}
}
