import {cache} from 'react';
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
  websiteDatabase()`select g.price,g.bedrooms,g.plots,d.key as development_key,d.town,d.latitude,d.longitude,d.display_name as development,c.href,b.name as builder from showhome_web.galleries g join showhome_web.buildings t on t.key=g.building_key join showhome_web.developments d on d.key=g.development_key join showhome_web.builders b on b.slug=g.builder_slug left join showhome_web.directory_cards c on c.kind='locations' and c.development_url=d.source_url and c.builder_slug=g.builder_slug and c.is_ready where g.builder_slug=any(${slugs}::text[]) and lower(t.name)=lower(${name}) order by d.display_name`,
  readDevelopmentPublicRoutes()
 ]);
 return {rows,canonical};
});
export async function BuildingOverviewDetails({slugs,name}:{slugs:string[];name:string}){
 const {rows,canonical}=await buildingOverviewData(slugs,name);
 const developments=[...new Map(rows.map(row=>[row.development_key,row])).values()];
 const prices=rows.flatMap(row=>[row.price,...(Array.isArray(row.plots)?row.plots.map(plot=>plot.price):[])]).filter(value=>value!==null&&value!==undefined).map(Number);
 return <div className="development-overview-details"><dl className="site-property-summary">
  <div><dt>Building Type</dt><dd>{homeTypeName(name)}</dd></div>
  <div><dt>Builder</dt><dd>{[...new Set(rows.map(row=>String(row.builder)))].join(' · ')||'Not available'}</dd></div>
  <div><dt>Bedrooms</dt><dd>{range(rows.filter(row=>row.bedrooms!==null).map(row=>Number(row.bedrooms)))}</dd></div>
  <div><dt>Developments</dt><dd><BuildingDevelopmentList buildingName={homeTypeName(name)} developments={developments.map(row=>({key:String(row.development_key),name:developmentName(String(row.development)),href:row.href?canonical[row.href]??String(row.href):null,town:row.town??null,latitude:row.latitude??null,longitude:row.longitude??null,price:range(rows.filter(candidate=>candidate.development_key===row.development_key).flatMap(candidate=>[candidate.price,...(Array.isArray(candidate.plots)?candidate.plots.map(plot=>plot.price):[])]).filter(value=>value!==null&&value!==undefined).map(Number),true)}))}/></dd></div>
  <div><dt>Prices</dt><dd>{range(prices,true)}</dd></div>
 </dl></div>;
}
