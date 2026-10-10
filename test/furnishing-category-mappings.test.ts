import {afterAll,expect,it} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
const db=new PGlite();
afterAll(()=>db.close());
it('maps and deduplicates categories without changing classifications, and queues new labels for review',async()=>{
 await db.exec('create role anon;create role authenticated;');
 await db.exec(await readFile('supabase/migrations/20261006000100_website_catalogue.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261009000100_image_furnishings.sql','utf8'));
 await db.exec('create table showhome_web.query_cache(key text);create table showhome_web.gallery_publication_summaries(key text);');
 const metadata={categorisation:{objects:['Candle','Candles','Bath Candle','Bath Tray','Bathroom Cabinet Frame','Boiler','Boots']}};
 await db.query(`insert into showhome_web.builders(slug,name,website_url) values('test','Test','https://example.com')`);
 await db.query(`insert into showhome_web.images(key,builder_slug,catalogue_id,path,source_url,metadata) values('test:a','test','a','a.jpg','https://example.com/a',$1)`,[JSON.stringify(metadata)]);
 await db.exec(await readFile('supabase/migrations/20261010000300_furnishing_category_mappings.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261010000400_refine_furnishing_groups.sql','utf8'));
 const categories=async()=> (await db.query<{name:string}>('select name from showhome_web.image_furnishing_categories order by name')).rows.map(r=>r.name);
 expect(await categories()).toEqual(['bath trays','bathroom cabinets','candles']);
 expect((await db.query('select metadata from showhome_web.images')).rows[0]?.metadata).toEqual(metadata);
 expect((await db.query('select name from showhome_web.image_furnishings')).rows).toHaveLength(7);
 await db.exec("update showhome_web.furnishing_category_mappings set category_name='decorative candles' where source_name in ('candle','candles','bath candle')");
 expect(await categories()).toEqual(['bath trays','bathroom cabinets','decorative candles']);
 await db.query('update showhome_web.images set metadata=$1 where key=$2',[JSON.stringify({categorisation:{objects:['Previously Unseen Object','Candles']}}),'test:a']);
 expect(await categories()).toEqual(['decorative candles']);
 expect((await db.query("select decision,category_name from showhome_web.furnishing_category_mappings where source_name='previously unseen object'")).rows).toEqual([{decision:'pending',category_name:null}]);
 await db.exec("delete from showhome_web.images where key='test:a'");
 expect(await categories()).toEqual([]);
},60000);

it('merges descriptive variants while preserving functional types and excluding incidental objects',async()=>{
 const objects=['Coffee Table','Coffee Tables','Circular Coffee Table','Glass Coffee Table','Wood And Metal Bar Stools','Bath Tray','Wooden Bath Tray','Bath Trays','Tray','Floor Lamp','Table Lamp','Bathroom Cabinet Frame','Kitchen Cabinet','Deer Head Ornament','Whale Ornament','Bed Base','Boiler','Boots','Ceiling','Aprons','Toy Car'];
 await db.query(`insert into showhome_web.images(key,builder_slug,catalogue_id,path,source_url,metadata) values('test:b','test','b','b.jpg','https://example.com/b',$1)`,[JSON.stringify({categorisation:{objects}})]);
 const categories=(await db.query<{name:string}>("select name from showhome_web.image_furnishing_categories where image_id='b' order by name")).rows.map(r=>r.name);
 expect(categories).toEqual(['bar stools','bath trays','bathroom cabinets','coffee tables','floor lamps','kitchen cabinets','ornaments','table lamps','trays']);
 expect((await db.query("select name from showhome_web.image_furnishings where image_id='b'")).rows).toHaveLength(objects.length);
},60000);
