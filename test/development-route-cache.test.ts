import {beforeAll,afterAll,expect,it,vi} from 'vitest';
import {readFile} from 'node:fs/promises';
const {database,statements}=vi.hoisted(()=>({database:import('@electric-sql/pglite').then(({PGlite})=>new PGlite()),statements:[] as string[]}));
vi.mock('../src/database/postgres',()=>({createDatabase:()=>Object.assign(async(parts:TemplateStringsArray,...values:unknown[])=>{
 const query=parts.reduce((text,part,index)=>text+(index?`$${index}`:'')+part,'');statements.push(query);
 return (await (await database).query(query,values)).rows;
},{json:JSON.stringify})}));
import {readDevelopmentPublicRoutes} from '../src/database/development-public-routes';
beforeAll(async()=>{
 const db=await database;
 await db.exec('create role anon; create role authenticated;');
 for(const file of ['20261006000100_website_catalogue.sql','20261006000400_gallery_and_query_cache.sql','20261006001200_directory_ready_flag.sql'])await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 await db.exec(`insert into showhome_web.builders(slug,name,website_url) values('test','Test','https://example.com');insert into showhome_web.directory_cards(kind,key,name,href,payload,is_ready) values('locations','one','Example Place','/developments/test/exampleplace','{}',true)`);
});
afterAll(async()=>{await (await database).close();});
it('stores compact routes, reuses memory, and immediately refreshes on publication',async()=>{
 const first=await readDevelopmentPublicRoutes();
 expect(first.canonical['/developments/test/exampleplace']).toBe('/developments/example-place');
 const db=await database;
 expect((await db.query(`select payload from showhome_web.query_cache where key='development:public-routes:v2'`)).rows[0]?.payload).toEqual([['/developments/test/exampleplace','/developments/example-place']]);
 statements.length=0;
 expect(await readDevelopmentPublicRoutes()).toBe(first);expect(statements).toHaveLength(1);
 await db.exec('update showhome_web.publication_revision set revision=revision+1;update showhome_web.directory_cards set is_ready=false');
 const next=await readDevelopmentPublicRoutes();expect(next.canonical).toEqual({});expect(next).not.toBe(first);
});
