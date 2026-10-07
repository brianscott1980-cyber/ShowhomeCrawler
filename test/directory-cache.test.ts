import {beforeAll,afterAll,expect,it,vi} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import type postgres from 'postgres';
import {cachedGallery} from '../src/database/gallery-cache';
import {cachedDirectory} from '../src/database/directory-cache';
const db=new PGlite();
const sql=Object.assign(async(strings:TemplateStringsArray,...values:unknown[])=>{const query=strings.reduce((q,s,i)=>q+s+(i<values.length?'$'+(i+1):''),'');return (await db.query(query,values)).rows;},{json:JSON.stringify}) as unknown as postgres.Sql;
const data={cards:[],total:1,nextOffset:0,hasMore:false,counts:{Styles:1},facets:{}};
beforeAll(async()=>{await db.exec('create role anon; create role authenticated;create schema showhome_web;');await db.exec(await readFile('supabase/migrations/20261006000400_gallery_and_query_cache.sql','utf8'));});
afterAll(()=>db.close());
it('shares results across requests, expires them and invalidates on publication',async()=>{
 const query=vi.fn(async()=>data);
 await cachedDirectory({kind:'buildings'},sql,query);await cachedDirectory({kind:'buildings',filters:{view:'list'}},sql,query);expect(query).toHaveBeenCalledTimes(1);
 await db.exec("update showhome_web.query_cache set expires_at=now()-interval '1 minute'");await cachedDirectory({kind:'buildings'},sql,query);expect(query).toHaveBeenCalledTimes(2);
 await db.exec('begin; update showhome_web.publication_revision set revision=revision+1; delete from showhome_web.query_cache; commit;');await cachedDirectory({kind:'buildings'},sql,query);expect(query).toHaveBeenCalledTimes(3);
});
it('does not cache radius searches or viewport criteria',async()=>{
 const query=vi.fn(async()=>data);
 for(let i=0;i<2;i++)await cachedDirectory({kind:'locations',point:{latitude:55,longitude:-4},filters:{radius:'25'}},sql,query);
 for(let i=0;i<2;i++)await cachedDirectory({kind:'locations',keys:[]},sql,query);expect(query).toHaveBeenCalledTimes(4);
});
it('rejects late cache writes following a newer publication',async()=>{
 const query=async()=>{await db.exec('update showhome_web.publication_revision set revision=revision+1');return data;};
 await cachedDirectory({kind:'interiors'},sql,query);
 expect((await db.query("select count(*)::int as count from showhome_web.query_cache where payload->'counts'->>'Styles'='1' and revision=(select revision from showhome_web.publication_revision)")).rows).toEqual([{count:0}]);
});

it('keeps default directory pages until publication and isolates nearest-first locations',async()=>{
 const query=vi.fn(async(_input:unknown)=>data);
 const request={kind:'locations' as const,filters:{order:'distance'},point:{latitude:55,longitude:-4}};
 await cachedDirectory(request,sql,query);await cachedDirectory(request,sql,query);
 expect(query).toHaveBeenCalledTimes(1);
 expect(query.mock.calls[0]?.[0]).toEqual(expect.objectContaining({point:request.point}));
 expect(Number((await db.query("select count(*)::int as count from showhome_web.query_cache where expires_at='infinity'::timestamptz")).rows[0]?.count)).toBeGreaterThan(0);
 await cachedDirectory({...request,point:{latitude:51,longitude:0}},sql,query);
 expect(query).toHaveBeenCalledTimes(2);
});
it('persists unfiltered gallery first pages and invalidates after publication',async()=>{
 const gallery={images:[],total:0,nextOffset:0,hasMore:false,counts:{'Unique images':0,Developments:0,Properties:0},facets:{category:[],room:[],developer:[],bedrooms:[],location:[],site:[],development:[]}};
 const query=vi.fn(async()=>gallery),request={scope:{kind:'interiors' as const,href:'/interiors/bedroom'}};
 await cachedGallery(request,sql,query);await cachedGallery({...request,filters:{developer:'',colour:''}},sql,query);
 expect(query).toHaveBeenCalledTimes(1);
 const rows=await db.query("select expires_at::text as expiry from showhome_web.query_cache where key like 'gallery:static-rolodex-v6:%'");
 expect(rows.rows).toEqual([{expiry:'infinity'}]);
 await db.exec('update showhome_web.publication_revision set revision=revision+1');
 await cachedGallery(request,sql,query);expect(query).toHaveBeenCalledTimes(2);
});
it('binds a boolean expiry policy rather than an infinity timestamp parameter',async()=>{
 const parameters:unknown[][]=[];
 const guardedSql=Object.assign(async(strings:TemplateStringsArray,...values:unknown[])=>{
  parameters.push(values);
  // postgres.js serializes timestamp parameters as JS dates. Infinity must be a SQL literal.
  expect(values).not.toContain('infinity');
  return sql(strings,...values);
 },{json:JSON.stringify}) as unknown as postgres.Sql;
 const query=async()=>data;
 await cachedDirectory({kind:'builders',limit:7},guardedSql,query);
 await cachedDirectory({kind:'builders',filters:{developer:'Alpha'},limit:7},guardedSql,query);
 expect(parameters.some(values=>values.includes(true))).toBe(true);
 expect(parameters.some(values=>values.includes(false))).toBe(true);
});
