import {beforeAll,afterAll,expect,it} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import type postgres from 'postgres';
import {queryDirectory} from '../src/database/directory-query';
const db=new PGlite();
const sql={json:JSON.stringify,unsafe:async(query:string,values:unknown[])=> (await db.query(query,values)).rows} as unknown as postgres.Sql;
beforeAll(async()=>{
 await db.exec('create role anon; create role authenticated;');
 for(const file of ['20261006000100_website_catalogue.sql','20261006000200_directory_routes.sql','20261006000300_directory_filter_rows.sql','20261006000400_gallery_and_query_cache.sql','20261006000500_gallery_building_index.sql','20261006000800_gallery_memberships.sql'])await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 await db.exec(`insert into showhome_web.directory_cards(kind,key,name,payload) values
 ('locations','a','A','{"key":"a","name":"A","properties":[]}'),('locations','b','B','{"key":"b","name":"B","properties":[]}'),
 ('buildings','house','House','{"key":"house","name":"House","places":[{}],"interiorIds":["one"]}'),
 ('interiors','room','Bedroom','{"key":"room","name":"Bedroom"}');
 insert into showhome_web.directory_filter_rows(kind,card_key,developer,bedrooms,price,site,site_id,areas,image_ids) values
 ('locations','a','Alpha',2,100000,'A','a','{}','{}'),('locations','a','Alpha',5,500000,'A','a','{}','{}'),
 ('locations','b','Beta',5,400000,'B','b','{}','{}'),
 ('buildings','house','Alpha',2,null,'North','north','{North}','{}'),('buildings','house','Alpha',5,null,'South','south','{South}','{}'),
 ('interiors','room','Alpha',2,null,'North','north','{North}','{one,two}'),('interiors','room','Alpha',5,null,'South','south','{South}','{two}'),('interiors','room','Alpha',null,null,null,null,'{}','{orphan}');`);
});
afterAll(()=>db.close());
it('paginates stable results while counts include unloaded cards',async()=>{
 const first=await queryDirectory({kind:'locations',limit:1},sql),next=await queryDirectory({kind:'locations',limit:1,offset:first.nextOffset},sql);
 expect(first.cards.map(c=>c.key)).toEqual(['a']);expect(next.cards.map(c=>c.key)).toEqual(['b']);expect(first.total).toBe(2);expect(first.hasMore).toBe(true);expect(next.hasMore).toBe(false);
});
it('matches bedroom/price against the same home and cascades facets',async()=>{
 const data=await queryDirectory({kind:'locations',filters:{minBeds:'5',maxPrice:'150000'}},sql);
 expect(data.total).toBe(0);expect(data.facets.beds).toEqual([2]);expect(data.facets.price).toEqual([400000,500000]);
});
it('orders prices by the offers matching the bedroom criteria',async()=>{
 expect((await queryDirectory({kind:'locations',filters:{minBeds:'5',order:'price-asc'}},sql)).cards.map(c=>c.key)).toEqual(['b','a']);
 expect((await queryDirectory({kind:'locations',filters:{minBeds:'5',order:'price-desc'}},sql)).cards.map(c=>c.key)).toEqual(['a','b']);
});
it('correlates building bedrooms, area and development on one membership',async()=>{
 expect((await queryDirectory({kind:'buildings',filters:{bedrooms:'5',site:'North'}},sql)).total).toBe(0);
 const data=await queryDirectory({kind:'buildings',filters:{bedrooms:'5',location:'South'}},sql);
 expect(data.total).toBe(1);expect(data.cards[0].places).toBeUndefined();expect(data.cards[0].interiorIds).toBeUndefined();expect(data.counts.Developments).toBe(1);
});
it('counts distinct interior identities across galleries and orphan photographs',async()=>{
 expect((await queryDirectory({kind:'interiors'},sql)).counts.Interiors).toBe(3);
 expect((await queryDirectory({kind:'interiors',filters:{bedrooms:'5'}},sql)).counts.Interiors).toBe(1);
});
it('represents an empty map viewport without returning all cards',async()=>{
 const data=await queryDirectory({kind:'locations',keys:[]},sql);expect(data.total).toBe(0);expect(data.mapCards).toHaveLength(2);
});
