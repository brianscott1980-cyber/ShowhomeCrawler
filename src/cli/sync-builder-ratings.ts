import {readFile} from 'node:fs/promises';
import {createDatabase} from '../database/postgres.js';
import {developers} from '../adapters/developers.js';
import {z} from 'zod';
import {readGoogleSnapshots,syncGoogleSnapshots} from '../ratings/google-snapshots.js';
const entry=z.object({slug:z.string(),hbf:z.object({rating:z.number().int().min(1).max(5).nullable(),compositeScore:z.number().min(1).max(5).nullable(),compositeSource:z.url().nullable(),year:z.number().int(),awardName:z.string().nullable(),source:z.url(),checkedAt:z.string(),status:z.string(),scope:z.string().nullable(),relationshipSource:z.string().nullable(),recheck:z.json().optional()}),trustpilot:z.object({rating:z.number().min(0).max(5).nullable(),reviewCount:z.number().int().positive().nullable(),url:z.url().nullable(),profileName:z.string().nullable(),checkedAt:z.string(),status:z.string(),evidenceMethod:z.string(),scope:z.string().nullable()})});
async function main(){
 const data=z.array(entry).parse(JSON.parse(await readFile('src/data/builder-ratings.json','utf8')));
 if(data.length!==developers.length||new Set(data.map(r=>r.slug)).size!==data.length||developers.some(b=>!data.some(r=>r.slug===b.slug)))throw new Error('Rating dataset must cover the complete builder registry exactly once.');
 const google=await readGoogleSnapshots();
 const db=createDatabase();
 try{await db.begin(async tx=>{
 for(const row of data){
  const builder=developers.find(b=>b.slug===row.slug)!;const h=row.hbf,t=row.trustpilot;
  const [saved]=await tx`insert into public.builders (slug,name,website_url) values (${builder.slug},${builder.name},${builder.website}) on conflict(slug) do update set website_url=excluded.website_url returning id`;
  const id=saved!.id;
  await tx`update public.builders set hbf_rating=${h.rating},hbf_composite_score=${h.compositeScore},hbf_year=${h.year},hbf_award_name=${h.awardName},hbf_source_url=${h.source},hbf_checked_at=${h.checkedAt},trustpilot_rating=case when trustpilot_checked_at is null or trustpilot_checked_at<=${t.checkedAt}::timestamptz then ${t.rating} else trustpilot_rating end,trustpilot_review_count=case when trustpilot_checked_at is null or trustpilot_checked_at<=${t.checkedAt}::timestamptz then ${t.reviewCount} else trustpilot_review_count end,trustpilot_url=case when trustpilot_checked_at is null or trustpilot_checked_at<=${t.checkedAt}::timestamptz then ${t.url} else trustpilot_url end,trustpilot_checked_at=case when trustpilot_checked_at is null or trustpilot_checked_at<=${t.checkedAt}::timestamptz then ${t.checkedAt} else trustpilot_checked_at end,ratings_evidence=${tx.json({hbf:h,trustpilot:t})},updated_at=now() where id=${id}`;
  if(t.rating!==null&&t.url&&t.reviewCount){
   await tx`insert into public.builder_review_sources (builder_id,provider,profile_key,profile_name,rating,average_rating,review_count,source_url,scope,status,checked_at,evidence) values (${id},'trustpilot',${new URL(t.url).pathname},${t.profileName},${t.rating},${t.rating},${t.reviewCount},${t.url},${t.scope??'builder'},'verified',${t.checkedAt},${tx.json({method:t.evidenceMethod})}) on conflict(builder_id,provider,profile_key) do update set profile_name=excluded.profile_name,rating=excluded.rating,average_rating=excluded.average_rating,review_count=excluded.review_count,source_url=excluded.source_url,scope=excluded.scope,status=excluded.status,checked_at=excluded.checked_at,evidence=excluded.evidence where public.builder_review_sources.checked_at<=excluded.checked_at`;
  }else{
   await tx`insert into public.builder_review_sources (builder_id,provider,profile_key,scope,status,checked_at,evidence) values (${id},'trustpilot','unverified','builder','unverified',${t.checkedAt},${tx.json({method:t.evidenceMethod})}) on conflict(builder_id,provider,profile_key) do nothing`;
  }
 }
 await syncGoogleSnapshots(tx,google);
 await tx`select public.refresh_builder_site_ranks()`;
 });console.log(JSON.stringify(await db`select count(*)::int as builders,count(hbf_rating)::int as hbf_ratings,count(trustpilot_rating)::int as trustpilot_ratings,count(site_rank)::int as ranked_builders from public.builders`));
 }finally{await db.end();}
}
main().catch(()=>{console.error('Rating sync failed; check the dataset and database configuration. Connection details withheld.');process.exitCode=1;});
