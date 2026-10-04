import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {it,expect} from 'vitest';
it('ranks by HBF, review volume, then weighted score; ignores unverified sources and shares ties',async()=>{
 const db=new PGlite();
 try{
 await db.exec('create table public.builders(id uuid primary key default gen_random_uuid(),hbf_rating smallint,hbf_rank integer);');
 await db.exec(await readFile('supabase/migrations/20261004000200_builder_site_rank.sql','utf8'));
 const ids=['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004'];
 for(const [i,id] of ids.entries())await db.query('insert into builders(id,hbf_rating) values ($1,$2)',[id,i===3?null:5]);
 for(const [id,provider,rating,count] of [[ids[0],'trustpilot',4.8,10],[ids[0],'google',2,90],[ids[1],'trustpilot',4,100],[ids[2],'trustpilot',4,100],[ids[3],'trustpilot',5,1000]])await db.query("insert into builder_review_sources(builder_id,provider,profile_key,average_rating,review_count,source_url,status,checked_at) values ($1,$2,'profile',$3,$4,'https://example.com','verified',now())",[id,provider,rating,count]);
 await db.query("insert into builder_review_sources(builder_id,provider,profile_key,average_rating,review_count,status,checked_at) values ($1,'google','pending',5,99999,'unverified',now())",[ids[0]]);
 await db.exec('select refresh_builder_site_ranks();');
 const rows=(await db.query<{site_rank:number}>('select site_rank from builders order by id')).rows;
 expect(rows.map(r=>r.site_rank)).toEqual([2,1,1,3]);
 const summary=(await db.query<{average_rating:string}>('select average_rating from builder_review_summary where builder_id=$1',[ids[0]])).rows[0];
 expect(Number(summary?.average_rating)).toBeCloseTo(2.28);
 }finally{await db.close();}
});
