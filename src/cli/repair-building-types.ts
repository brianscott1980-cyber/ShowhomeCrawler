import {parseArgs} from 'node:util';
import {websiteDatabase,readWebsiteCollection} from '../database/website';
import {groupDirectoryData} from '../catalogue/directory-projections';
import {directoryFilterRows} from '../catalogue/filter-rows';
import {galleryProjection} from '../catalogue/gallery-projection';
import {refreshDirectoryReadiness} from '../catalogue/publish';
const {values}=parseArgs({options:{builder:{type:'string'},all:{type:'boolean',default:false},apply:{type:'boolean',default:false}}});
if(!values.builder&&!values.all)throw Error('Pass --builder <slug> or --all, and --apply to persist');
const sql=websiteDatabase();
try{
 const builders=await sql`select slug,name from showhome_web.builders where (${values.builder??null}::text is null or slug=${values.builder??null}) order by slug`;
 if(!builders.length)throw Error('Builder not found');
 for(const builder of builders){
  const slug=String(builder.slug),report=await readWebsiteCollection(slug);if(!report)continue;
  const collection={slug,name:String(builder.name),report},data=await groupDirectoryData('buildings',[collection]);
  console.log(`${slug}: ${data.cards.length} named building types${values.apply?'':' (preview)'}`);
  if(!values.apply)continue;
  const projection=await galleryProjection(collection);
  await sql.begin(async tx=>{
   await tx`select pg_advisory_xact_lock(726391042)`;
   const references=new Map(data.references.map(reference=>[reference.key,reference]));
   for(let offset=0;offset<data.cards.length;offset+=100){
    const cards=data.cards.slice(offset,offset+100).map(card=>({kind:'buildings',key:card.key,name:card.name,href:card.href!,builder_slug:slug,collection_slugs:[slug],building_name:references.get(card.key)!.buildingName,payload:card}));
    await tx.unsafe(`insert into showhome_web.directory_cards(kind,key,name,href,builder_slug,collection_slugs,building_name,payload) select kind,key,name,href,builder_slug,collection_slugs,building_name,payload from jsonb_populate_recordset(null::showhome_web.directory_cards,$1::jsonb) on conflict(kind,key) do update set name=excluded.name,href=excluded.href,building_name=excluded.building_name,payload=excluded.payload`,[tx.json(cards as never)]);
   }
   await tx`delete from showhome_web.directory_filter_rows where kind='buildings' and card_key=any(${data.cards.map(card=>card.key)}::text[])`;
   const rows=data.cards.flatMap(card=>directoryFilterRows('buildings',card)).map(row=>({developer:null,bedrooms:null,price:null,style:null,site:null,site_id:null,areas:[],region:null,latitude:null,longitude:null,image_ids:[],building_types:[],...row}));
   for(let offset=0;offset<rows.length;offset+=250)await tx.unsafe(`insert into showhome_web.directory_filter_rows(kind,card_key,developer,bedrooms,price,style,site,site_id,areas,region,latitude,longitude,image_ids,building_types) select kind,card_key,developer,bedrooms,price,style,site,site_id,areas,region,latitude,longitude,image_ids,building_types from jsonb_populate_recordset(null::showhome_web.directory_filter_rows,$1::jsonb)`,[tx.json(rows.slice(offset,offset+250) as never)]);
   for(let offset=0;offset<projection.length;offset+=200)await tx.unsafe(`update showhome_web.gallery_card_index i set building_names=r.building_names from jsonb_populate_recordset(null::showhome_web.gallery_card_index,$1::jsonb) r where i.uid=r.uid`,[tx.json(projection.slice(offset,offset+200).map(({uid,building_names})=>({uid,building_names})) as never)]);
   await tx`update showhome_web.presentations set payload=jsonb_set(payload,'{counts,Building types}',to_jsonb(${data.cards.length}::int)),updated_at=now() where key=${'builder:'+slug}`;
  });
 }
 if(values.apply)await sql.begin(async tx=>{
  await tx`select pg_advisory_xact_lock(726391042)`;
  await refreshDirectoryReadiness(tx);
  const [counts]=await tx`select count(*)::int as styles from showhome_web.directory_cards where kind='buildings' and is_ready`;
  const [developments]=await tx`select count(distinct r.site_id)::int as count from showhome_web.directory_filter_rows r join showhome_web.directory_cards c on c.kind=r.kind and c.key=r.card_key where c.kind='buildings' and c.is_ready`;
  await tx`update showhome_web.presentations set payload=payload||jsonb_build_object('Styles',${counts!.styles}::int,'Developments',${developments!.count}::int),updated_at=now() where key='counts:buildings'`;
  await tx`update showhome_web.presentations set payload=jsonb_set(payload,'{Building types}',to_jsonb(${counts!.styles}::int)),updated_at=now() where key='counts:builders'`;
  await tx`update showhome_web.publication_revision set revision=revision+1 where singleton=true`;
 });
 console.log(values.apply?'Building directories, memberships and counts repaired.':'Preview only; pass --apply to repair.');
}finally{await sql.end();}
