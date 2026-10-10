import type {LocalArea} from '../enrichment/local-area';
import {distanceLabels} from '../enrichment/local-area';
import {websiteDatabase} from '../database/website';
export async function readDevelopmentArea(builder:string,url:string):Promise<LocalArea|undefined>{const [row]=await websiteDatabase()`select crawl_metadata->'localArea' as area from showhome_web.developments where builder_slug=${builder} and source_url=${url}`;return row?.area??undefined;}
export function DevelopmentArea({area}:{area?:LocalArea}){
 if(!area)return null;
 return <section className="development-area" aria-labelledby="development-area-heading">
  <h2 id="development-area-heading">The local area</h2>
  {area.summary&&<p className="development-area-summary">{area.summary}</p>}
  {!area.summary&&<p>Verified local area information is not yet available.</p>}
  {area.places.length>0&&<dl className="site-property-summary development-area-distances">{distanceLabels(area.places).map(place=><div key={place.kind}><dt>{place.label}</dt><dd><a href={place.url} target="_blank" rel="noreferrer">{place.name}</a><span>{place.miles.toFixed(1)} miles</span></dd></div>)}</dl>}
  <p className="development-area-note">Approximate straight-line distances{area.coordinateMethod==='postcode-centre'?' from the development postcode centre':''}; walking and driving routes will differ.</p>
  <details className="development-area-sources"><summary>Sources and check date</summary><p>AI-assisted summary of mapped amenities within one mile. Map coverage may be incomplete.</p>{area.sources.map(source=><p key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.name}</a> · {new Date(source.checkedAt).toLocaleDateString('en-GB',{timeZone:'Europe/London'})}</p>)}<p>Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>.</p></details>
 </section>;
}
