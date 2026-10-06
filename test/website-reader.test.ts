import {beforeAll,afterAll,expect,it,vi} from 'vitest';
import {readFile} from 'node:fs/promises';
const {database}=vi.hoisted(()=>({database:import('@electric-sql/pglite').then(({PGlite})=>new PGlite())}));
vi.mock('../src/database/postgres',()=>({createDatabase:()=>async(parts:TemplateStringsArray,...values:unknown[])=>{
 const query=parts.reduce((text,part,index)=>text+(index?`$${index}`:'')+part,'');
 return (await (await database).query(query,values)).rows;
}}));
import {readWebsiteCollection} from '../src/database/website';
beforeAll(async()=>{
 const db=await database;
 await db.exec('create role anon; create role authenticated;');
 await db.exec(await readFile('supabase/migrations/20261006000100_website_catalogue.sql','utf8'));
 await db.exec(`insert into showhome_web.builders(slug,name,website_url) values('test','Test','https://example.com');
 insert into showhome_web.developments(key,builder_slug,source_url,name,display_name) values('development','test','https://example.com/development','Development','Development');
 insert into showhome_web.buildings(key,builder_slug,name) values('building','test','the example');
 insert into showhome_web.galleries(key,builder_slug,development_key,building_key,name,source_url,bedrooms,price) values('gallery','test','development','building','The Example','https://example.com/gallery',3,250000);
 insert into showhome_web.images(key,builder_slug,catalogue_id,path,source_url,main_category,is_room,eligible,metadata) values
 ('linked','test','linked','images/linked.jpg','https://example.com/linked.jpg','Bedroom',true,true,'{"id":"linked","path":"images/linked.jpg"}'),
 ('orphan','test','orphan','images/orphan.jpg','https://example.com/orphan.jpg','Bedroom',true,true,'{"id":"orphan","path":"images/orphan.jpg"}');
 insert into showhome_web.gallery_images values('gallery','linked',0);`);
});
afterAll(async()=>{await (await database).close();});
it('retains category images without a house-type link',async()=>{
 const report=await readWebsiteCollection('test',{category:'Bedroom'});
 expect(report?.images.map(i=>i.id)).toEqual(['linked','orphan']);
 expect(report?.properties[0]).toMatchObject({bedrooms:3,price:250000,imageIds:['linked']});
});
it('restricts development galleries to their linked images',async()=>{
 const report=await readWebsiteCollection('test',{developmentUrl:'https://example.com/development',category:'Bedroom'});
 expect(report?.images.map(i=>i.id)).toEqual(['linked']);
});
it('returns null for unknown builders',async()=>{expect(await readWebsiteCollection('missing')).toBeNull();});
