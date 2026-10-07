import {beforeAll,afterAll,beforeEach,afterEach,vi,expect,it} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import type postgres from 'postgres';
import {interiorCardCounts} from '../src/database/interior-card-counts';
import {queryGallery} from '../src/database/gallery-query';
const db=new PGlite();
const sql=Object.assign(async(strings:TemplateStringsArray,...values:unknown[])=>{const query=strings.reduce((q,s,i)=>q+s+(i<values.length?'$'+(i+1):''),'');return (await db.query(query,values)).rows;},{json:JSON.stringify,unsafe:async(query:string,values:unknown[])=>(await db.query(query,values)).rows}) as unknown as postgres.Sql;
beforeEach(()=>vi.stubEnv('NEXT_PUBLIC_CASCADING_FILTERS','true'));
afterEach(()=>vi.unstubAllEnvs());
beforeAll(async()=>{
 await db.exec('create role anon; create role authenticated;');
 for(const file of ['20261006000100_website_catalogue.sql','20261006000200_directory_routes.sql','20261006000400_gallery_and_query_cache.sql','20261006000500_gallery_building_index.sql','20261006000800_gallery_memberships.sql'])await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 await db.exec('create view showhome_web.gallery_card_index as select * from showhome_web.gallery_cards');
 await db.exec(`insert into showhome_web.directory_cards(kind,key,name,href,collection_slugs,building_name,category,payload) values ('buildings','house','House','/buildings/alpha/house','{alpha}','House',null,'{}'),('interiors','bedroom','Bedroom','/interiors/bedroom','{alpha}',null,'Bedroom','{}')`);
 await db.exec(`insert into showhome_web.builders(slug,name,website_url) values('alpha','Alpha','https://example.com');
 insert into showhome_web.developments(key,builder_slug,source_url,name,display_name,geography) values('North','alpha','North','North','North','{"area":"North"}'),('South','alpha','South','South','South','{"area":"South"}');
 insert into showhome_web.buildings(key,builder_slug,name) values('house','alpha','house');
 insert into showhome_web.galleries(key,builder_slug,development_key,building_key,name,source_url,bedrooms,price) values('north','alpha','North','house','House','North',2,100000),('south500','alpha','South','house','House','South',5,500000),('south400','alpha','South','house','House','South',5,400000);`);
 const home=(site:string,beds:number,price:number)=>({name:'House',buildingName:'House',url:site,development:site,developmentUrl:site,bedrooms:beds,price,areas:[site],plots:[],imageIds:[]});
 for(const [id,homes,eligible] of [['a',[home('North',2,100000),home('South',5,500000)],true],['b',[home('South',5,400000)],true],['orphan',[],true],['logo',[],false],['uncategorised',[],true]] as const){
 await db.query('insert into showhome_web.images(key,builder_slug,catalogue_id,path,source_url) values($1,$2,$3,$4,$5)',[id,'alpha',id,'images/'+id+'.jpg','https://example.com/'+id]);
 const payload={uid:'alpha:'+id,id,slug:'alpha',developer:'Alpha',homes,path:'images/'+id+'.jpg'};
 await db.query('insert into showhome_web.gallery_cards values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[payload.uid,'alpha',id,'Alpha',id==='uncategorised'?'Uncategorised':'Bedroom','Double Bedroom',eligible,true,'blue bedroom',JSON.stringify(payload),homes.length?['house']:[]]);
 }
 await db.exec("insert into showhome_web.gallery_images values('north','a',0),('south500','a',0),('south400','b',0)");
 await db.exec(`insert into showhome_web.gallery_memberships select c.uid,g.key,g.builder_slug,g.source_url,g.bedrooms,g.price,d.source_url,d.name,b.name,array(select value from jsonb_each_text(d.geography)) from showhome_web.gallery_cards c join showhome_web.images i on i.catalogue_id=c.image_id and i.builder_slug=c.builder_slug join showhome_web.gallery_images gi on gi.image_key=i.key join showhome_web.galleries g on g.key=gi.gallery_key join showhome_web.developments d on d.key=g.development_key join showhome_web.buildings b on b.key=g.building_key`);
});
afterAll(()=>db.close());
it('paginates galleries without changing full counters and includes orphan category images',async()=>{
 const first=await queryGallery({scope:{kind:'interiors',href:'/interiors/bedroom'},limit:1},sql);
 expect(first.total).toBe(3);expect(first.images).toHaveLength(1);expect(first.counts.Developments).toBe(2);
 const next=await queryGallery({scope:{kind:'interiors',href:'/interiors/bedroom'},limit:2,offset:first.nextOffset},sql);
 expect(next.images.map(i=>i.id)).toEqual(['b','orphan']);expect(next.hasMore).toBe(false);
});
it('correlates home filters and calculates facets from unloaded records',async()=>{
 const data=await queryGallery({scope:{kind:'buildings',href:'/buildings/alpha/house'},filters:{bedrooms:'5',site:'North'}},sql);
 expect(data.total).toBe(0);expect(data.facets.bedrooms).toEqual([2]);expect(data.facets.site).toEqual(['South']);
 const price=await queryGallery({scope:{kind:'buildings',href:'/buildings/alpha/house'},filters:{minBeds:'5',maxPrice:'150000'}},sql);expect(price.total).toBe(0);
});
it('scopes favourites to requested IDs and pins a linked image in the first batch',async()=>{
 const saved=await queryGallery({scope:{kind:'favourites',href:'/favourites'},favourites:['logo']},sql);expect(saved.images.map(i=>i.id)).toEqual(['logo']);
 const linked=await queryGallery({scope:{kind:'interiors',href:'/interiors/bedroom'},selectedUid:'alpha:orphan',limit:1},sql);expect(linked.images[0]?.id).toBe('orphan');expect(linked.total).toBe(3);
});
it('applies text and category filters to the complete gallery',async()=>{
 const data=await queryGallery({scope:{kind:'interiors',href:'/interiors/bedroom'},filters:{q:'BLUE',category:'Bedroom',room:'Double Bedroom'}},sql);expect(data.total).toBe(3);
});

it('excludes uncategorised images even when saved as favourites',async()=>{
 const result=await queryGallery({scope:{kind:'favourites',href:'/favourites'},favourites:['uncategorised']},sql);
 expect(result.total).toBe(0);expect(result.images).toEqual([]);
});
it('paginates shared images by house type and correlates filters with that type',async()=>{
 await db.exec(`update showhome_web.gallery_cards set building_names=array['house','other'],payload=payload||jsonb_build_object('homes',(payload->'homes')||'[ {"name":"Other","buildingName":"Other","url":"Other","development":"North","developmentUrl":"North","bedrooms":3,"price":200000,"imageIds":[],"plots":[]} ]'::jsonb) where image_id='a';
 insert into showhome_web.gallery_memberships values('alpha:a','other','alpha','Other',3,200000,'North','North','other','{North}');`);
 const data=await queryGallery({scope:{kind:'interiors',href:'/interiors/bedroom'}},sql);
 expect(data.total).toBe(4);expect(data.counts['Unique images']).toBe(3);
 const shared=data.images.filter(image=>image.id==='a');expect(shared).toHaveLength(2);
 expect(shared.map(image=>new Set(image.homes.map(home=>home.buildingName)).size)).toEqual([1,1]);
 const filtered=await queryGallery({scope:{kind:'interiors',href:'/interiors/bedroom'},filters:{minBeds:'5'}},sql);
 expect(filtered.images.filter(image=>image.id==='a').map(image=>image.uid)).toEqual(['alpha:a:house:house']);
 const first=await queryGallery({scope:{kind:'interiors',href:'/interiors/bedroom'},limit:1,selectedUid:'alpha:a'},sql);
 expect(first.images[0]?.id).toBe('a');expect(first.nextOffset).toBe(1);expect(first.hasMore).toBe(true);
});

it('room card counts equal gallery totals for correlated filters and shared house types',async()=>{
 for(const filters of [{},{developer:'Alpha'},{bedrooms:'2'},{bedrooms:'5',site:'North'},{location:'North',site:'North'},{building:'other'},{building:'house',site:'South'}]){
  const counts=await interiorCardCounts(['bedroom'],filters,sql);
  const gallery=await queryGallery({scope:{kind:'interiors',href:'/interiors/bedroom'},filters},sql);
  expect(counts.get('bedroom')??0).toBe(gallery.total);
 }
});

it('shares scoped relations in one statement for counts, facets and page data',async()=>{
 const statements:string[]=[];
 const measured=Object.assign((...args:unknown[])=>(sql as any)(...args),{json:sql.json,unsafe:(query:string,values:unknown[])=>{statements.push(query);return sql.unsafe(query,values as never);}}) as unknown as postgres.Sql;
 const result=await queryGallery({scope:{kind:'interiors',href:'/interiors/bedroom'},filters:{developer:'Alpha',building:'house',site:'South',q:'blue'},limit:1},measured);
 expect(result.total).toBe(2);expect(result.images).toHaveLength(1);
 expect(statements).toHaveLength(1);
 expect(statements[0]).toContain('homes as materialized');
 expect(result.facets.site).toEqual(['North','South']);
 const image=await queryGallery({scope:{kind:'interiors',href:'/interiors/bedroom'},selectedUid:'alpha:b',imageOnly:true,limit:1},sql);
 expect(image.images[0]?.id).toBe('b');
});

it('queries all room types when scoped to /interiors/all',async()=>{
 const all=await queryGallery({scope:{kind:'interiors',href:'/interiors/all'}},sql);
 expect(all.total).toBeGreaterThan(0);
 expect(all.facets.category).toContain('Bedroom');
});

it('keeps independent gallery options when cascading is disabled',async()=>{
 vi.stubEnv('NEXT_PUBLIC_CASCADING_FILTERS','false');
 const result=await queryGallery({scope:{kind:'buildings',href:'/buildings/alpha/house'},filters:{bedrooms:'5',site:'North'}},sql);
 expect(result.total).toBe(0);
 expect(result.facets.bedrooms).toEqual([2,5]);
 expect(result.facets.site).toEqual(['North','South']);
});

it('reuses unfiltered gallery totals instead of recalculating them for new filters',async()=>{
 vi.stubEnv('NEXT_PUBLIC_CASCADING_FILTERS','false');
 const queries:string[]=[];
 const measured=Object.assign((...args:unknown[])=>(sql as any)(...args),{json:sql.json,unsafe:(query:string,values:unknown[])=>{queries.push(query);return sql.unsafe(query,values as never);}}) as unknown as postgres.Sql;
 const scope={kind:'buildings' as const,href:'/buildings/alpha/house'};
 const before=await queryGallery({scope},measured);
 queries.length=0;
 const after=await queryGallery({scope,filters:{bedrooms:'5',site:'North'}},measured);
 expect(after.total).toBe(0);expect(after.counts).toEqual(before.counts);
 expect(queries).toHaveLength(1);
 expect(queries[0]).not.toContain('count(distinct h.builder_slug');
});

it('reuses initial gallery filter options across filter changes',async()=>{
 vi.stubEnv('NEXT_PUBLIC_CASCADING_FILTERS','false');
 const queries:string[]=[];
 const measured=Object.assign((...args:unknown[])=>(sql as any)(...args),{json:sql.json,unsafe:(query:string,values:unknown[])=>{queries.push(query);return sql.unsafe(query,values as never);}}) as unknown as postgres.Sql;
 const scope={kind:'buildings' as const,href:'/buildings/alpha/house'};
 const first=await queryGallery({scope},measured);
 queries.length=0;
 const filtered=await queryGallery({scope,filters:{bedrooms:'5'}},measured);
 expect(filtered.facets).toEqual(first.facets);
 expect(queries).toHaveLength(1);
 expect(queries[0]).not.toContain('jsonb_agg(distinct h.bedrooms');
});
it('offers colour and non-colour tags across the scope and filters them before pagination',async()=>{
 await db.exec(`update showhome_web.images set metadata='{"categorisation":{"colours":["Blue"],"decor":["Blue Decor"],"wallpaperTags":["Floral Wallpaper"],"furnishingTags":["Gold Lamp","Boucle Chair"]}}' where catalogue_id='a'`);
 const result=await queryGallery({scope:{kind:'interiors',href:'/interiors/bedroom'},filters:{colour:'Blue Decor',tag:'Floral Wallpaper',building:'house'},limit:1},sql);
 expect(result.total).toBe(1);
 expect(result.images[0]?.id).toBe('a');
 expect(result.facets.colour).toContain('Gold Lamp');
 expect(result.facets.tag).toContain('Boucle Chair');
 expect(result.facets.tag).not.toContain('Blue Decor');
 expect(result.facets.building).toEqual(['house','other']);
 await db.exec(`update showhome_web.images set metadata='{}' where catalogue_id='a'`);
});

it('keeps a landing colour in the source scope, including counts and later batches',async()=>{
 vi.stubEnv('NEXT_PUBLIC_CASCADING_FILTERS','false');
 await db.exec(`update showhome_web.images set metadata='{"categorisation":{"colours":["Blue"],"decor":["Blue Decor"]}}' where catalogue_id='a'`);
 try{
  const scope={kind:'interiors' as const,href:'/interiors/bedroom',fixedFilters:{colour:'["Blue","Blue Decor"]'}};
  const first=await queryGallery({scope,limit:1},sql);
  expect(first.images.map(image=>image.id)).toEqual(['a']);
  expect(first.total).toBe(2);expect(first.counts['Unique images']).toBe(1);
  expect(first.facets.colour).toEqual(['Blue','Blue Decor']);
  const next=await queryGallery({scope,offset:1},sql);
  expect(next.images.map(image=>image.id)).toEqual(['a']);expect(next.counts).toEqual(first.counts);
  expect((await queryGallery({scope,offset:2},sql)).images).toEqual([]);
 }finally{await db.exec(`update showhome_web.images set metadata='{}' where catalogue_id='a'`);}
});
