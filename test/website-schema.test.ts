import {afterAll,beforeAll,expect,it} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
const db=new PGlite();
beforeAll(async()=>{
 await db.exec('create role anon; create role authenticated;');
 for(const file of ['20261006000100_website_catalogue.sql','20261006000200_directory_routes.sql'])await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 await db.exec(`insert into showhome_web.builders(slug,name,website_url) values('test','Test','https://example.com');
 insert into showhome_web.developments(key,builder_slug,source_url,name,display_name) values('ready','test','https://example.com/ready','Ready','Ready'),('empty','test','https://example.com/empty','Empty','Empty');
 insert into showhome_web.buildings(key,builder_slug,name) values('building','test','The Example');
 insert into showhome_web.images(key,builder_slug,catalogue_id,path,source_url,eligible) values('image','test','image','images/example.jpg','https://example.com/image.jpg',true);
 insert into showhome_web.galleries(key,builder_slug,development_key,building_key,name,source_url) values('gallery','test','ready','building','Example','https://example.com/gallery');
 insert into showhome_web.gallery_images values('gallery','image',0);
 insert into showhome_web.offers(development_key,bedrooms,price) values('ready',2,100000),('ready',5,500000);`);
});
afterAll(()=>db.close());
it('keeps catalogue relations unique and rejects broken gallery links',async()=>{
 await expect(db.exec("insert into showhome_web.gallery_images values('gallery','image',1)")).rejects.toThrow();
 await expect(db.exec("insert into showhome_web.gallery_images values('missing','image',1)")).rejects.toThrow();
});
it('only marks developments with eligible linked images ready',async()=>{
 const result=await db.query<{key:string}>(`select d.key from showhome_web.developments d where exists(select 1 from showhome_web.galleries g join showhome_web.gallery_images gi on gi.gallery_key=g.key join showhome_web.images i on i.key=gi.image_key where g.development_key=d.key and i.eligible)`);
 expect(result.rows).toEqual([{key:'ready'}]);
});
it('matches bedrooms and prices against the same advertised offer',async()=>{
 const query=`select d.key from showhome_web.developments d where exists(select 1 from showhome_web.offers o where o.development_key=d.key and o.bedrooms>=5 and o.price<=$1)`;
 expect((await db.query(query,[150000])).rows).toEqual([]);
 expect((await db.query(query,[500000])).rows).toEqual([{key:'ready'}]);
});
it('keeps website records unavailable to browser database roles',async()=>{
 const result=await db.query<{allowed:boolean}>("select has_schema_privilege('anon','showhome_web','usage') as allowed union all select has_schema_privilege('authenticated','showhome_web','usage')");
 expect(result.rows.every(r=>!r.allowed)).toBe(true);
});
it('indexes directory ordering and reverse image relationships',async()=>{
 const result=await db.query<{indexname:string}>("select indexname from pg_indexes where schemaname='showhome_web'");
 expect(result.rows.map(r=>r.indexname)).toEqual(expect.arrayContaining(['web_directory_name','web_directory_price_asc','web_directory_price_desc','web_gallery_images_reverse','web_offers_beds_price']));
});
