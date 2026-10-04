'use client';
import type {BuilderFacts} from './builder-facts';
import {useDirectoryCounts} from './directory-counts';
import {DistanceFilter} from './distance-filter';
import {MultiSelectFilter} from './multi-select-filter';
import {filterBuilders,matchingBuilderLocations} from './builder-filters';
import {useUrlFilters} from './url-filters';
import {DirectoryFilters} from './directory-filters';
import {BuilderName} from './builder-name';
import {useEffect,useState} from 'react';
import {useLocationRequest} from './location-dialog';
import {useSavedLocation} from './location-preferences';
import {ScrollCollectionImage,type CollectionImage} from './scroll-collection-image';
import {ViewOptions,useCardView,type CardViewMode} from './view-options';
export interface Point {latitude:number;longitude:number}
const builderDefaults={region:'',radius:''};
export interface DeveloperCard extends BuilderFacts {slug:string;name:string;spaces:number;image:string;description:string;logo?:string;images?:CollectionImage[];locations:{buildingTypes?:string[];latitude?:number;longitude?:number;name:string;region?:string;key?:string}[]}
export function distanceMiles(a:Point,b:Point){const rad=(n:number)=>n*Math.PI/180;const dlat=rad(b.latitude-a.latitude),dlon=rad(b.longitude-a.longitude);const h=Math.sin(dlat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dlon/2)**2;return 3958.7613*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
export function orderedDevelopers(cards:DeveloperCard[],sort:string,point:Point|null){return cards.map(card=>({...card,nearest:point?card.locations.filter(location=>Number.isFinite(location.latitude)&&Number.isFinite(location.longitude)).map(location=>({...location,miles:distanceMiles(point,{latitude:location.latitude!,longitude:location.longitude!})})).sort((a,b)=>a.miles-b.miles)[0]:undefined})).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='distance'&&point?(a.nearest?.miles??Infinity)-(b.nearest?.miles??Infinity)||a.name.localeCompare(b.name):b.spaces-a.spaces||a.name.localeCompare(b.name));}
export function DeveloperDirectory({
 cards,
 defaultView = 'compact',
 storageKey = 'showhome-homebuilders-view',
}:{
 cards:DeveloperCard[];
 defaultView?: CardViewMode;
 storageKey?: string;
}){
 const [view,changeView]=useCardView(storageKey,defaultView);
 const [sort,setSort]=useState('name');
 const [point,setPoint]=useState<Point|null>(null);
 const savedLocation=useSavedLocation();
 useEffect(()=>{setPoint(savedLocation);},[savedLocation]);
 const [urlFilters,setFilters]=useUrlFilters(builderDefaults);
 const filters={...urlFilters,location:''};
 const {requestLocation,dialog}=useLocationRequest((location,intent)=>{setPoint(location);if(intent.key==='radius')setFilters(previous=>({...previous,radius:intent.value}));else setSort(intent.value);});
 const change=(key:keyof typeof builderDefaults,value:string)=>{if(key==='radius'&&value){void requestLocation(location=>{setPoint(location);setFilters(previous=>({...previous,radius:value}));},{key:'radius',value});}else setFilters(previous=>({...previous,[key]:value}));};
 const changeSort=(value:string)=>{if(value==='distance'){void requestLocation(location=>{setPoint(location);setSort(value);},{key:'order',value});}else setSort(value);};
 const filtered=filterBuilders(cards,filters,point);
 const regions=[...new Set(cards.flatMap(card=>matchingBuilderLocations(card,{...filters,region:''},point).map(location=>location.region??'Unknown')))].sort();
 const ordered=orderedDevelopers(filtered.map(card=>({...card,locations:matchingBuilderLocations(card,filters,point)})),sort,point);
 useDirectoryCounts({Builders:ordered.length,Developments:new Set(ordered.flatMap(card=>card.locations.map(location=>location.key??`${card.slug}:${location.name}`))).size,'Building types':new Set(ordered.flatMap(card=>card.locations.flatMap(location=>(location.buildingTypes??[]).map(type=>`${card.slug}:${type}`)))).size});
 const imageLayout=`${view}:${ordered.map(c=>c.slug).join(",")}`;
 return <section aria-label="Builder collections">{dialog}
  <div className="site-filter-panel builder-filter-panel">
   <DirectoryFilters className="filters" label="Builder filters">
    <MultiSelectFilter label="Site Locations" value={filters.region} options={regions} onChange={value=>change('region',value)}/>
    <DistanceFilter value={filters.radius} location={savedLocation} onChange={value=>change('radius',value)} onChangeLocation={()=>{void requestLocation(location=>setPoint(location),{key:'radius',value:filters.radius},true);}}/>
    <button type="button" className="location-filter-reset" onClick={()=>setFilters(builderDefaults)}>Reset filters</button>
   </DirectoryFilters>

  </div>
  <div className="directory-toolbar"><ViewOptions view={view} onChange={changeView} ariaLabel="Collection layout"/><p className="count" aria-live="polite">{ordered.length} of {cards.length} builders</p><div className="sort-control"><label htmlFor="directory-order">Order by</label><select id="directory-order" value={sort} onChange={e=>changeSort(e.target.value)}><option value="name">Name A–Z</option><option value="spaces">Most interiors</option><option value="distance">Nearest distance</option></select></div></div><div className={`collection-grid directory-${view}`}>{ordered.map(card=><a className="collection-card" href={`/developers/${card.slug}`} key={card.slug}><ScrollCollectionImage images={card.images} image={card.image} description={card.description} layout={imageLayout}/><div className="card-body"><p className="eyebrow">THE HOMEBUILDER COLLECTION</p><h2><BuilderName name={card.name}/><span aria-hidden="true">↗</span></h2><dl className="builder-card-facts"><div><dt>HBF rating</dt><dd title={card.rating?`${card.rating.scope?card.rating.scope+' group award. ':''}Source: ${card.rating.source}`:'No verified HBF rating available'}>{card.rating?<><span className="builder-rating-stars" aria-hidden="true">{'★'.repeat(card.rating.stars)}</span><span className="sr-only">{card.rating.stars} stars</span> <span className="builder-rating-year">{card.rating.year}{card.rating.scope?' · Group':''}</span></>:'Not available'}</dd></div><div><dt>Incentives</dt><dd title={card.incentives?`Advertised on selected homes; eligibility and terms apply. Checked ${card.incentives.checkedAt}. Source: ${card.incentives.source}`:'Offer availability has not been verified'}>{card.incentives?'Selected homes':'Not verified'}</dd></div></dl><p>{card.spaces} inspiring interiors</p>{sort==='distance'&&point&&<p className="subtle">{card.nearest?`${card.nearest.miles.toFixed(1)} miles · ${card.nearest.name}`:'Location unavailable'}</p>}<span className="subtle">Explore collection →</span></div></a>)}</div>{!ordered.length&&<p className="empty">No builders match these filters. Try widening your search.</p>}</section>;
}
