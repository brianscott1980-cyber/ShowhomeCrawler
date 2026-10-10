import {afterAll,expect,it} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
const db=new PGlite();
afterAll(()=>db.close());
it('backfills strict-majority exterior flags and refreshes them at publication',async()=>{
 await db.exec('create role anon;create role authenticated');
 for(const file of ['20261006000100_website_catalogue.sql','20261006000400_gallery_and_query_cache.sql'])await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 await db.exec(`insert into showhome_web.builders(slug,name,website_url) values('a','A','https://example.com');
 insert into showhome_web.developments(key,builder_slug,source_url,name,display_name) values('d','a','d','D','D');
 insert into showhome_web.buildings(key,builder_slug,name) values('one','a','One'),('two','a','Two'),('three','a','Three');
 insert into showhome_web.galleries(key,builder_slug,development_key,building_key,name,source_url) values('g1','a','d','one','One','g1'),('g2','a','d','two','Two','g2'),('g3','a','d','three','Three','g3');
 insert into showhome_web.images(key,builder_slug,catalogue_id,path,source_url,main_category) values('generic','a','generic','generic.jpg','generic','Exterior'),('unique','a','unique','unique.jpg','unique','Front Elevation'),('inside','a','inside','inside.jpg','inside','Bedroom');
 insert into showhome_web.gallery_images values('g1','generic',0),('g2','generic',0),('g1','unique',1),('g1','inside',2),('g2','inside',1),('g3','inside',0);`);
 await db.exec(await readFile('supabase/migrations/20261010000100_generic_exterior_flags.sql','utf8'));
 const flags=async()=> (await db.query('select key,is_generic_exterior from showhome_web.images order by key')).rows;
 expect(await flags()).toEqual([{key:'generic',is_generic_exterior:true},{key:'inside',is_generic_exterior:false},{key:'unique',is_generic_exterior:false}]);
 await db.exec("delete from showhome_web.gallery_images where gallery_key='g2' and image_key='generic'; update showhome_web.publication_revision set revision=revision+1");
 expect((await flags())[0].is_generic_exterior).toBe(false);
 // Exactly half does not qualify.
 await db.exec("delete from showhome_web.galleries where key='g3'; update showhome_web.publication_revision set revision=revision+1");
 expect((await flags())[0].is_generic_exterior).toBe(false);
 await db.exec("insert into showhome_web.gallery_images values('g2','generic',2); update showhome_web.publication_revision set revision=revision+1");
 expect((await flags())[0].is_generic_exterior).toBe(true);
 // A builder with only one type must never qualify.
 await db.exec("delete from showhome_web.galleries where key='g2'; update showhome_web.publication_revision set revision=revision+1");
 expect((await flags())[0].is_generic_exterior).toBe(false);
},60000);
