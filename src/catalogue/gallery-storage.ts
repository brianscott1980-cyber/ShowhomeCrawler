import type postgres from 'postgres';
type Writer=postgres.Sql|postgres.TransactionSql;
async function compact(sql:Writer){const [row]=await sql`select to_regclass('showhome_web.gallery_card_index') is not null as compact`;return Boolean(row?.compact);}
export async function clearGalleryProjection(sql:Writer,slug?:string){
 const table=await compact(sql)?'gallery_card_index':'gallery_cards';
 if(slug)await sql.unsafe(`delete from showhome_web.${table} where builder_slug=$1`,[slug]);else await sql.unsafe(`delete from showhome_web.${table}`);
}
export async function insertGalleryProjection(sql:Writer,rows:Record<string,unknown>[]){
 const normalized=await compact(sql),table=normalized?'gallery_card_index':'gallery_cards';
 const columns=normalized?['uid','builder_slug','image_id','builder_name','category','room','eligible','verdict_matches','search_text','building_names']:['uid','builder_slug','image_id','builder_name','category','room','eligible','verdict_matches','search_text','payload','building_names'];
 const fields=columns.join(',');
 for(let offset=0;offset<rows.length;offset+=200){const batch=rows.slice(offset,offset+200).map(row=>Object.fromEntries(columns.map(column=>[column,row[column]])));await sql.unsafe(`insert into showhome_web.${table}(${fields}) select ${fields} from jsonb_populate_recordset(null::showhome_web.${table},$1::jsonb)`,[sql.json(batch as never)]);}
}
export async function refreshGalleryMemberships(sql:Writer,slug?:string){
 if(await compact(sql))return; // Derived by the relational view after migration 009.
 await sql`insert into showhome_web.gallery_memberships select c.uid,g.key,g.builder_slug,g.source_url,g.bedrooms,g.price,d.source_url,d.name,b.name,array(select distinct value from jsonb_each_text(d.geography) where value is not null and value<>'') from showhome_web.gallery_cards c join showhome_web.images i on i.builder_slug=c.builder_slug and i.catalogue_id=c.image_id join showhome_web.gallery_images gi on gi.image_key=i.key join showhome_web.galleries g on g.key=gi.gallery_key join showhome_web.developments d on d.key=g.development_key join showhome_web.buildings b on b.key=g.building_key where (${slug??null}::text is null or c.builder_slug=${slug??null})`;
}
