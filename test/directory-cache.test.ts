import {beforeAll,afterAll,expect,it,vi} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import type postgres from 'postgres';
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
