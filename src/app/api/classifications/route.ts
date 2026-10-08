import {createClient} from '@supabase/supabase-js';
import {publicAuthConfig} from '../../../auth/public-config';
import {classificationOwnerId} from '../../../auth/classification-owner';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store'};
 const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
 const config=publicAuthConfig(process.env);
 if(!token)return Response.json({error:'Sign in to view classifications.'},{status:401,headers});
 if(!config)return Response.json({error:'Authentication unavailable.'},{status:503,headers});
 const client=createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await client.auth.getUser(token);
 if(error||data.user?.id!==classificationOwnerId)return Response.json({error:'Access denied.'},{status:403,headers});
 const folder=resolve('classification-reports');
 const files=await readdir(folder).catch(()=>[]);
 const builders=files.filter(f=>f.endsWith('.json')).map(f=>f.slice(0,-5)).sort();
 const selected=new URL(request.url).searchParams.get('builder')??builders[0];
 if(selected&&!builders.includes(selected))return Response.json({error:'Unknown builder'},{status:404,headers});
 const reports=selected?[JSON.parse(await readFile(resolve(folder,selected+'.json'),'utf8'))]:[];
 return Response.json({builders,commit:process.env.VERCEL_GIT_COMMIT_SHA??'local',reports}, {headers});
}
