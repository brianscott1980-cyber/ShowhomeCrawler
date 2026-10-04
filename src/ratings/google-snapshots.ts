import {readFile} from 'node:fs/promises';
import type {TransactionSql, JSONValue} from 'postgres';
import {z} from 'zod';
import {developers} from '../adapters/developers.js';

const mapsUrl=z.url().refine(value=>{
 const url=new URL(value);
 return url.protocol==='https:'&&url.hostname==='www.google.com'&&url.pathname.startsWith('/maps');
},'Google snapshots must link to a Google Maps listing');
const common={slug:z.string(),checkedAt:z.iso.date(),method:z.string().min(1),note:z.string()};
export const googleSnapshotSchema=z.discriminatedUnion('status',[
 z.object({...common,status:z.literal('verified'),profileName:z.string().min(1),address:z.string().min(1),rating:z.number().min(0).max(5),reviewCount:z.number().int().positive(),url:mapsUrl,verificationSource:z.url()}),
 z.object({...common,status:z.literal('unverified'),profileName:z.null(),address:z.null(),rating:z.null(),reviewCount:z.null(),url:z.null(),verificationSource:z.null(),researchUrl:mapsUrl})
]);
export async function readGoogleSnapshots(){
 const rows=z.array(googleSnapshotSchema).parse(JSON.parse(await readFile('src/data/builder-google-reviews.json','utf8')));
 if(rows.length!==developers.length||new Set(rows.map(r=>r.slug)).size!==rows.length||developers.some(b=>!rows.some(r=>r.slug===b.slug)))throw new Error('Google research must cover every registered builder exactly once.');
 return rows;
}

export async function syncGoogleSnapshots(tx:TransactionSql,rows:Awaited<ReturnType<typeof readGoogleSnapshots>>){
 for(const snapshot of rows){
  const [builder]=await tx`select id from public.builders where slug=${snapshot.slug}`;
  if(!builder)throw new Error('Sync builder registry before Google snapshots');
  // One main-office snapshot per builder avoids counting old and new listings twice.
  await tx`insert into public.builder_review_sources (builder_id,provider,profile_key,profile_name,rating,average_rating,review_count,source_url,scope,status,checked_at,evidence)
   values (${builder.id},'google','main-office',${snapshot.profileName},${snapshot.rating},${snapshot.rating},${snapshot.reviewCount},${snapshot.url},'main office',${snapshot.status},${snapshot.checkedAt},${tx.json(snapshot as JSONValue)})
   on conflict(builder_id,provider,profile_key) do update set profile_name=excluded.profile_name,rating=excluded.rating,average_rating=excluded.average_rating,review_count=excluded.review_count,source_url=excluded.source_url,status=excluded.status,checked_at=excluded.checked_at,evidence=excluded.evidence
   where public.builder_review_sources.checked_at<=excluded.checked_at`;
 }
 return {researched:rows.length,verified:rows.filter(r=>r.status==='verified').length,unverified:rows.filter(r=>r.status==='unverified').length};
}
