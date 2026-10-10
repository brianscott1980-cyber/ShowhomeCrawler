import type postgres from 'postgres';
import {selectedValues} from '../web/filter-selection';
/** Count the same unique images as the destination gallery, in one query. */
export async function interiorCardCounts(keys:string[],filters:Record<string,string>,sql:postgres.Sql){
 const values:unknown[]=[];
 const p=(value:unknown)=>{values.push(value);return '$'+values.length;};
 const selection=(field:string,key:string)=>{const selected=selectedValues(filters[key]??'');return selected.length?`${field} in(select jsonb_array_elements_text(${p(sql.json(selected))}::jsonb))`:'true';};
 const builder=selection('i.builder_name','developer');
 const conditions=['true'];
 const homes=[selection('h.building_name','building'),selection('h.bedrooms::text','bedrooms'),selection('h.development','site')];
 if(filters.location)homes.push(`h.areas && array(select jsonb_array_elements_text(${p(sql.json(selectedValues(filters.location)))}::jsonb))`);
 if(['building','bedrooms','site','location'].some(key=>filters[key]))conditions.push(`exists(select 1 from showhome_web.gallery_memberships h where h.uid=i.uid and ${homes.join(' and ')})`);
 const query=`with cards as materialized(select key,category,collection_slugs from showhome_web.directory_cards where kind='interiors' and key in(select jsonb_array_elements_text(${p(sql.json(keys))}::jsonb))),images as materialized(select i.uid,i.image_id,i.category,i.builder_slug,i.building_names from showhome_web.gallery_card_index i where i.eligible and ${builder} and exists(select 1 from cards c where i.category=c.category and i.builder_slug=any(c.collection_slugs))) select c.key,count(distinct i.image_id)::int as count,count(distinct i.image_id)::int as unique_count from cards c join images i on i.builder_slug=any(c.collection_slugs) and i.category=c.category where ${conditions.join(' and ')} group by c.key`;
 const rows=await sql.unsafe(query,values as never);
 return Object.assign(new Map(rows.map(row=>[row.key as string,Number(row.count)])),{uniqueCounts:new Map(rows.map(row=>[row.key as string,Number(row.unique_count)]))});
}
