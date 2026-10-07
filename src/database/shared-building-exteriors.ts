import {websiteDatabase} from './website';
let pending:Promise<string[]>|undefined;
let expires=0;
/** An exterior shared by a strict majority of a builder's types is generic marketing imagery. */
export function sharedBuildingExteriorPaths():Promise<string[]>{
 if(pending&&Date.now()<expires)return pending;
 expires=Date.now()+5*60*1000;
 pending=websiteDatabase()`with totals as (select builder_slug,count(distinct building_key) as types from showhome_web.galleries group by builder_slug)
 select i.builder_slug,i.path from showhome_web.images i join showhome_web.gallery_image_links gi on gi.image_id=i.internal_id join showhome_web.galleries g on g.internal_id=gi.gallery_id join totals t on t.builder_slug=i.builder_slug
 where lower(i.main_category) in ('exterior','front elevation','facade') group by i.builder_slug,i.path,t.types having count(distinct g.building_key)>t.types/2.0 and t.types>1`.then(rows=>rows.map(row=>`/api/assets/${row.builder_slug}/${String(row.path).split('/').map(encodeURIComponent).join('/')}`)).catch(error=>{pending=undefined;throw error;});
 return pending;
}
