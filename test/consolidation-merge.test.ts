import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {classificationUpgradeSQL} from '../src/cli/consolidate-local';
it('actual upgrade SQL preserves classified records and remote metadata while adding missing classifications',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create schema showhome_web;create table showhome_web.images(key text,builder_slug text,catalogue_id text,source_url text,metadata jsonb,main_category text,is_room boolean,eligible boolean);
  insert into showhome_web.images values('a','builder','a','remote-url','{"custom":"edited","categorisation":{"mainCategory":"Bedroom"}}','Bedroom',true,true),('b','builder','b','remote-url','{"custom":"edited"}',null,false,false);`);
  const payload=['a','b'].map(id=>({key:id,builder_slug:'builder',catalogue_id:id,source_url:'local-url',metadata:{categorisation:{mainCategory:'Kitchen'},analysisModel:'local'},main_category:'Kitchen',is_room:true,eligible:true}));
  const changed=await db.query(classificationUpgradeSQL,[JSON.stringify(payload)]);expect(changed.rows).toEqual([{key:'b'}]);
  const rows=(await db.query<any>('select * from showhome_web.images order by key')).rows;
  expect(rows[0].metadata.categorisation.mainCategory).toBe('Bedroom');expect(rows[1].metadata.categorisation.mainCategory).toBe('Kitchen');
  for(const row of rows){expect(row.source_url).toBe('remote-url');expect(row.metadata.custom).toBe('edited');}
  expect((await db.query(classificationUpgradeSQL,[JSON.stringify(payload)])).rows).toEqual([]);
 }finally{await db.close();}
});
