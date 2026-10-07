import {cache} from 'react';
import {websiteDatabase} from '../database/website';
import {readDevelopmentPublicRoutes} from '../database/development-public-routes';
import {builderBrand} from './builder-brand';
import type {BuildingDevelopment} from './building-development-list';
import type {SiteCard} from './site-filters';
export const builderMapDevelopments=cache(async(slug:string):Promise<BuildingDevelopment[]>=>{
 const [rows,{canonical}]=await Promise.all([websiteDatabase()`select preview.path as preview_path,c.payload,c.href,d.contact,d.town,d.latitude,d.longitude,b.logo_url,b.logo_background from showhome_web.directory_cards c join showhome_web.developments d on d.source_url=c.development_url and d.builder_slug=c.builder_slug join showhome_web.builders b on b.slug=c.builder_slug left join lateral (
 select i.path from showhome_web.galleries g join showhome_web.gallery_image_links gi on gi.gallery_id=g.internal_id join showhome_web.images i on i.internal_id=gi.image_id
 where g.development_key=d.key and i.eligible and lower(i.main_category) in ('exterior','street scene','street view','aerial')
 order by (concat_ws(' ',i.metadata->'categorisation'->>'subCategory',i.metadata->'verdict'->>'description') ~* 'street scene|streetscape|street view|cul-de-sac|multiple (houses|homes|buildings)|row of (houses|homes|buildings)|several (houses|homes|buildings)|development overview|site overview|aerial|bird.?s.eye') desc,gi.position,i.catalogue_id limit 1
 ) preview on true where c.kind='locations' and c.builder_slug=${slug} and c.is_ready order by c.name`,readDevelopmentPublicRoutes()]);
 return rows.map(row=>{const card=row.payload as SiteCard;const prices=card.properties.map(p=>p.price).filter((p):p is number=>p!==null&&Number.isFinite(p));const beds=card.properties.map(p=>p.bedrooms).filter((p):p is number=>p!==null&&Number.isFinite(p));return {key:card.key,name:card.name,href:canonical[row.href]??row.href,developer:card.developer,image:row.preview_path?`/api/assets/${slug}/${String(row.preview_path).split('/').map(encodeURIComponent).join('/')}`:card.image||null,logo:row.logo_url??null,logoBackground:row.logo_background??'#fff',primaryColour:builderBrand(slug)?.primary,town:row.town??null,latitude:row.latitude??null,longitude:row.longitude??null,telephone:row.contact?.telephone,openingHours:row.contact?.openingHours??[],bedrooms:beds.length?`${Math.min(...beds)} – ${Math.max(...beds)}`:'Not available',price:prices.length?`£${Math.min(...prices).toLocaleString('en-GB')} – £${Math.max(...prices).toLocaleString('en-GB')}`:'Not available'};});
});
