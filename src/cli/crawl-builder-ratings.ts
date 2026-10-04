import {readFile} from 'node:fs/promises';
import {load} from 'cheerio';
import {createDatabase} from '../database/postgres.js';
import {developers} from '../adapters/developers.js';
import {z} from 'zod';
import type {JSONValue} from 'postgres';
import {readGoogleSnapshots,syncGoogleSnapshots} from '../ratings/google-snapshots.js';
const score=z.object({rating:z.number().min(0).max(5),count:z.number().int().positive(),url:z.url()});
const ratings=JSON.parse(await readFile('src/data/builder-ratings.json','utf8')) as {slug:string;trustpilot:{url:string|null}}[];
const provider=process.argv.includes('--google')?'google':'trustpilot';
const db=createDatabase();let success=0,failed=0;
try{
 if(provider==='google'){
  const snapshots=await readGoogleSnapshots();
  const summary=await db.begin(async tx=>{
   const imported=await syncGoogleSnapshots(tx,snapshots);
   await tx`select public.refresh_builder_site_ranks()`;
   return imported;
  });
  console.log(JSON.stringify({provider,method:'reviewed web snapshots',...summary}));
 }else{
 for(const builder of developers){
  const profile=ratings.find(r=>r.slug===builder.slug)?.trustpilot.url;
  if(!profile)continue;
  try{
   let result:z.infer<typeof score>,key:string,name=builder.name as string,evidence:JSONValue;
    const response=await fetch(profile!,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('Trustpilot lookup unavailable');
    const $=load(await response.text());const nodes:Record<string,any>[]=[];
    const walk=(v:any)=>{if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(walk);return;}nodes.push(v);Object.values(v).forEach(walk);};
    $('script[type="application/ld+json"]').each((_,element)=>{try{walk(JSON.parse($(element).text()));}catch{}});
    const expected=new URL(profile!).pathname;
    const business=nodes.find(n=>n.aggregateRating&&typeof n.url==='string'&&new URL(n.url,'https://www.trustpilot.com').pathname===expected);
    if(!business||Number(business.aggregateRating.bestRating??5)!==5)throw new Error('Verified profile rating not found');
    result=score.parse({rating:Number(business.aggregateRating.ratingValue),count:Number(business.aggregateRating.reviewCount),url:profile});key=expected;name=business.name??builder.name;evidence={method:'Trustpilot profile structured aggregateRating',profileUrl:profile};
   await db.begin(async tx=>{
    const [row]=await tx`select id from public.builders where slug=${builder.slug}`;if(!row)throw new Error('Sync builder registry first');
    await tx`insert into public.builder_review_sources (builder_id,provider,profile_key,profile_name,rating,average_rating,review_count,source_url,scope,status,checked_at,evidence) values (${row.id},${provider},${key},${name},${result.rating},${result.rating},${result.count},${result.url},${'builder'},'verified',now(),${tx.json(evidence)}) on conflict(builder_id,provider,profile_key) do update set rating=excluded.rating,average_rating=excluded.average_rating,review_count=excluded.review_count,source_url=excluded.source_url,status='verified',checked_at=excluded.checked_at,evidence=excluded.evidence`;
    if(provider==='trustpilot')await tx`update public.builders set trustpilot_rating=${result.rating},trustpilot_review_count=${result.count},trustpilot_url=${result.url},trustpilot_checked_at=now() where id=${row.id}`;
   });success++;
  }catch{failed++;console.log(`${builder.slug}: unavailable; previous verified snapshot retained`);}
 }
 await db`select public.refresh_builder_site_ranks()`;
 console.log(JSON.stringify({provider,updated:success,unavailable:failed}));
 }
} catch(error){console.error(error instanceof Error?error.message:'Ratings crawl failed');process.exitCode=1;}
finally{await db.end();}
