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
 await db.exec(`insert into showhome_web.builders(slug,name,website_url,logo_url,logo_background) values('alpha','Alpha','https://example.com','/logos/alpha.png','#123456');
 update showhome_web.directory_cards set builder_slug='alpha',building_name='house' where kind='buildings';
 insert into showhome_web.buildings(key,builder_slug,name) values('house','alpha','House');
 insert into showhome_web.developments(key,builder_slug,source_url,name,display_name) values('a','alpha','a','A','A'),('b','alpha','b','B','B');
 insert into showhome_web.galleries(key,builder_slug,development_key,building_key,name,source_url) values('a','alpha','a','house','House','a'),('b','alpha','b','house','House','b');
 insert into showhome_web.images(key,builder_slug,catalogue_id,path,source_url,main_category,eligible) values('a','alpha','a','a.jpg','a','Exterior',true),('b','alpha','b','b.jpg','b','Bedroom',true);
 insert into showhome_web.gallery_images values('a','a',0),('b','b',0);`);
 await db.exec(`update showhome_web.directory_cards set builder_slug='alpha',development_url=key where kind='locations';
 insert into showhome_web.gallery_cards(uid,builder_slug,image_id,builder_name,category,eligible,verdict_matches,search_text,payload) values('ready-a','alpha','a','Alpha','Exterior',true,true,'','{}'),('ready-b','alpha','b','Alpha','Exterior',true,true,'','{}');
 update showhome_web.gallery_cards set building_names=array['house'] where uid in('ready-a','ready-b');
 insert into showhome_web.gallery_memberships(uid,gallery_key,builder_slug,url,development_url,development,building_name) values('ready-a','a','alpha','a','a','A','house'),('ready-b','b','alpha','b','b','B','house');`);
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

it('filters room cards, counts and cascading facets by building type',async()=>{
 await db.exec(`update showhome_web.directory_cards set category='Bedroom',collection_slugs='{alpha}' where kind='interiors';
 insert into showhome_web.gallery_cards(uid,builder_slug,image_id,builder_name,category,eligible,verdict_matches,search_text,payload,building_names) values('alpha:one','alpha','one','Alpha','Bedroom',true,true,'','{}','{house}');
 insert into showhome_web.gallery_memberships values('alpha:one','g','alpha','house',2,100000,'North','North','house','{North}');`);
 const data=await queryDirectory({kind:'interiors',filters:{developer:'Alpha',building:'house'}},sql);
 expect(data.cards).toHaveLength(1);expect(data.cards[0].count).toBe(1);expect(data.counts.Interiors).toBe(1);expect(data.facets.building).toEqual(['house']);
 const empty=await queryDirectory({kind:'interiors',filters:{building:'missing'}},sql);expect(empty.cards).toEqual([]);expect(empty.counts.Interiors).toBe(0);
});

it('cascades development and building options with builder and development selections',async()=>{
 await db.exec(`insert into showhome_web.gallery_cards(uid,builder_slug,image_id,builder_name,category,eligible,verdict_matches,search_text,payload,building_names) values('alpha:south','alpha','south','Alpha','Bedroom',true,true,'','{}','{other}');
 insert into showhome_web.gallery_memberships values('alpha:south','south','alpha','other',5,200000,'South','South','other','{South}');`);
 const builder=await queryDirectory({kind:'interiors',filters:{developer:'Alpha'}},sql);
 expect(builder.facets.site).toEqual(['North','South']);expect(builder.facets.building).toEqual(['house','other']);
 const north=await queryDirectory({kind:'interiors',filters:{developer:'Alpha',site:'North'}},sql);
 expect(north.facets.building).toEqual(['house']);expect(north.cards[0].count).toBe(1);
 const house=await queryDirectory({kind:'interiors',filters:{developer:'Alpha',building:'house'}},sql);
 expect(house.facets.site).toEqual(['North']);
 const absent=await queryDirectory({kind:'interiors',filters:{developer:'Beta'}},sql);
 expect(absent.facets.site).toEqual([]);expect(absent.facets.building).toEqual([]);
});

it('excludes stale developments whose linked images are not categorised',async()=>{
 await db.exec(`insert into showhome_web.directory_cards(kind,key,name,builder_slug,development_url,payload) values('locations','stale','Stale','alpha','stale','{"key":"stale"}');
 insert into showhome_web.directory_filter_rows(kind,card_key,developer,site) values('locations','stale','Alpha','Stale');
 insert into showhome_web.developments(key,builder_slug,source_url,name,display_name) values('stale','alpha','stale','Stale','Stale');
 insert into showhome_web.galleries(key,builder_slug,development_key,building_key,name,source_url) values('stale','alpha','stale','house','House','stale');
 insert into showhome_web.images(key,builder_slug,catalogue_id,path,source_url,main_category,eligible) values('stale','alpha','stale','stale.jpg','stale','Uncategorised',true);
 insert into showhome_web.gallery_images values('stale','stale',0);
 insert into showhome_web.gallery_cards(uid,builder_slug,image_id,builder_name,category,eligible,verdict_matches,search_text,payload) values('stale-image','alpha','stale','Alpha','Uncategorised',true,false,'','{}');
 insert into showhome_web.gallery_memberships(uid,gallery_key,builder_slug,url,development_url,development,building_name) values('stale-image','stale','alpha','stale','stale','Stale','house');`);
 const result=await queryDirectory({kind:'locations'},sql);
 expect(result.cards.map(card=>card.key)).toEqual(['a','b']);expect(result.counts.Developments).toBe(2);
 expect(result.mapCards?.some(card=>card.key==='stale')).toBe(false);
});

it('returns the current builder logo and backdrop on building cards',async()=>{
 const result=await queryDirectory({kind:'buildings'},sql);
 expect(result.cards[0]).toMatchObject({logo:'/logos/alpha.png',logoBackground:'#123456'});
});

it('hides empty and uncategorised building types from results and facets',async()=>{
 await db.exec(`insert into showhome_web.directory_cards(kind,key,name,builder_slug,building_name,payload) values('buildings','empty','Empty','alpha','empty','{"key":"empty"}');
 insert into showhome_web.directory_filter_rows(kind,card_key,developer,site,building_types) values('buildings','empty','Alpha','North','{empty}');
 update showhome_web.gallery_cards set building_names=array['empty'] where uid='stale-image';`);
 const result=await queryDirectory({kind:'buildings'},sql);
 expect(result.cards.map(card=>card.key)).toEqual(['house']);
 expect(result.total).toBe(1);expect(result.facets.type).not.toContain('Empty');
});
