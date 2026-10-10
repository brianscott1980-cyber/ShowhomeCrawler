import {cache} from 'react';
import {builderBrand} from './builder-brand';
import {BuildingDevelopmentList} from './building-development-list';
import {websiteDatabase} from '../database/website';
import {readDevelopmentPublicRoutes} from '../database/development-public-routes';
import {developmentName} from './development-name';
import {homeTypeName} from '../reports/home-display';
function range(values:number[],money=false){
 const known=values.filter(Number.isFinite);if(!known.length)return 'Not available';
 const min=Math.min(...known),max=Math.max(...known),format=(n:number)=>money?'£'+n.toLocaleString('en-GB'):String(n);
 return min===max?format(min):`${format(min)} – ${format(max)}`;
}
const buildingOverviewData=cache(async(slugs:string[],name:string)=>{
 const [rows,{canonical}]=await Promise.all([
  websiteDatabase()`select g.price,g.bedrooms,g.plots,g.builder_slug,preview.path as preview_path,d.contact,d.postcode,d.country,d.geography,d.key as development_key,d.town,d.latitude,d.longitude,d.display_name as development,c.href,c.payload as card,b.logo_url,b.logo_background,b.name as builder from showhome_web.galleries g join showhome_web.buildings t on t.key=g.building_key join showhome_web.developments d on d.key=g.development_key join showhome_web.builders b on b.slug=g.builder_slug left join lateral (
 select i.path from showhome_web.galleries pg join showhome_web.gallery_image_links gi on gi.gallery_id=pg.internal_id join showhome_web.images i on i.internal_id=gi.image_id
 where pg.development_key=d.key and i.eligible and not i.is_generic_exterior and lower(coalesce(i.main_category,'')) not in ('floorplan','floor plan','uncategorised','other','infographic','illustration','logo','map','marketing image','promotional graphic','document','unknown','')
 and (lower(i.main_category) not in ('exterior','front elevation','facade') or pg.building_key=g.building_key)
 order by (pg.building_key=g.building_key and lower(i.main_category)='exterior') desc,(pg.building_key=g.building_key) desc,gi.position,i.catalogue_id limit 1
 ) preview on true left join showhome_web.directory_cards c on c.kind='locations' and c.development_url=d.source_url and c.builder_slug=g.builder_slug and c.is_ready where g.builder_slug=any(${slugs}::text[]) and lower(t.name)=lower(${name}) order by d.display_name`,
  readDevelopmentPublicRoutes()
 ]);
 return {rows,canonical};
});
export async function BuildingOverviewDetails({slugs,name}:{slugs:string[];name:string}){
 const {rows,canonical}=await buildingOverviewData(slugs,name);
 const developments=[...new Map(rows.map(row=>[row.development_key,row])).values()];
 const bedroomCounts=[...new Set(rows.filter(row=>row.bedrooms!==null).map(row=>Number(row.bedrooms)).filter(value=>Number.isInteger(value)&&value>0))];
 const prices=rows.flatMap(row=>[row.price,...(Array.isArray(row.plots)?row.plots.map(plot=>plot.price):[])]).filter(value=>value!==null&&value!==undefined).map(Number);
 return <div className="development-overview-details"><dl className="site-property-summary">
  <div><dt>Building Type</dt><dd>{homeTypeName(name)}</dd></div>
  <div><dt>Builder</dt><dd>{[...new Set(rows.map(row=>String(row.builder)))].join(' · ')||'Not available'}</dd></div>
  <div className="building-bedroom-icons-row"><dt>Bedrooms</dt><dd>{bedroomCounts.length===1?<span className="building-bedroom-icons" role="img" aria-label={`${bedroomCounts[0]} bedrooms`}>{Array.from({length:bedroomCounts[0]!},(_,index)=><svg key={index} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 18V6M21 18v-7a2 2 0 0 0-2-2h-7v7M3 16h18M3 11h9"/><rect x="5" y="8" width="5" height="3" rx="1"/></svg>)}</span>:range(bedroomCounts)}</dd></div>
  <div><dt>Developments</dt><dd><BuildingDevelopmentList buildingName={homeTypeName(name)} developments={developments.map(row=>({key:String(row.development_key),name:developmentName(String(row.development)),href:row.href?canonical[row.href]??String(row.href):null,address:[typeof row.geography?.address==='string'?row.geography.address:null,row.town,row.postcode].filter(Boolean).join(', '),openingHours:row.contact?.openingHours??[],telephone:row.contact?.telephone??null,email:row.contact?.email??null,developer:String(row.builder),image:row.preview_path?`/api/assets/${row.builder_slug}/${String(row.preview_path).split('/').map(encodeURIComponent).join('/')}`:null,logo:row.logo_url??null,logoBackground:row.logo_background??'#fff',primaryColour:builderBrand(String(row.builder_slug))?.primary??'#23342e',town:row.town??null,latitude:row.latitude??null,longitude:row.longitude??null,bedrooms:range(rows.filter(candidate=>candidate.development_key===row.development_key&&candidate.bedrooms!==null).map(candidate=>Number(candidate.bedrooms))),price:range(rows.filter(candidate=>candidate.development_key===row.development_key).flatMap(candidate=>[candidate.price,...(Array.isArray(candidate.plots)?candidate.plots.map(plot=>plot.price):[])]).filter(value=>value!==null&&value!==undefined).map(Number),true)}))}/></dd></div>
  <div><dt>Prices</dt><dd>{range(prices,true)}</dd></div>
 </dl></div>;
}

export async function buildingDevelopmentPreviews(slugs:string[],name:string){
 const [rows,{canonical}]=await Promise.all([websiteDatabase()`
 select distinct c.href,c.name,c.payload->>'image' as image,b.name as builder,b.logo_url,b.logo_background,d.latitude,d.longitude,d.town
 from showhome_web.galleries g join showhome_web.buildings t on t.key=g.building_key
 join showhome_web.developments d on d.key=g.development_key
 join showhome_web.directory_cards c on c.kind='locations' and c.builder_slug=g.builder_slug and c.development_url=d.source_url and c.is_ready
 join showhome_web.builders b on b.slug=g.builder_slug
 where g.builder_slug=any(${slugs}::text[]) and lower(t.name)=lower(${name})
 order by c.name`,readDevelopmentPublicRoutes()]);
 return rows.map(row=>({href:canonical[row.href]??String(row.href),name:developmentName(String(row.name)),image:String(row.image??''),builderName:String(row.builder),builderLogo:row.logo_url??undefined,builderLogoBackground:row.logo_background??undefined,latitude:row.latitude??undefined,longitude:row.longitude??undefined,town:row.town??undefined}));
}
