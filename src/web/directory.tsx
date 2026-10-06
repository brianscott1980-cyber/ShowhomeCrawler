'use client';
import {useDirectoryQuery,DirectoryQueryStatus} from './use-directory-query';
import type {DirectoryPageData} from './directory-page-data';
import {CardResults} from './card-results';
import {builderDirectoryDefaults} from './builder-navigation';
import type {BuilderFacts} from './builder-facts';
import {useDirectoryCounts} from './directory-counts';
import {SingleSelectFilter} from './single-select-filter';
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
const builderDefaults=builderDirectoryDefaults;
export interface DeveloperCard extends BuilderFacts {slug:string;name:string;spaces:number;totalDevelopments?:number;image:string;description:string;logo?:string;images?:CollectionImage[];locations:{buildingTypes?:string[];latitude?:number;longitude?:number;name:string;region?:string;key?:string}[]}
export function distanceMiles(a:Point,b:Point){const rad=(n:number)=>n*Math.PI/180;const dlat=rad(b.latitude-a.latitude),dlon=rad(b.longitude-a.longitude);const h=Math.sin(dlat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dlon/2)**2;return 3958.7613*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
export function orderedDevelopers(cards:DeveloperCard[],sort:string,point:Point|null){return cards.map(card=>({...card,nearest:point?card.locations.filter(location=>Number.isFinite(location.latitude)&&Number.isFinite(location.longitude)).map(location=>({...location,miles:distanceMiles(point,{latitude:location.latitude!,longitude:location.longitude!})})).sort((a,b)=>a.miles-b.miles)[0]:undefined})).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='name-desc'?b.name.localeCompare(a.name):sort==='distance'&&point?(a.nearest?.miles??Infinity)-(b.nearest?.miles??Infinity)||a.name.localeCompare(b.name):b.spaces-a.spaces||a.name.localeCompare(b.name));}
export function DeveloperDirectory({
 cards,
 initial,
 defaultView = 'compact',
 storageKey = 'showhome-homebuilders-view',
}:{
 cards:DeveloperCard[];
 initial?:DirectoryPageData<DeveloperCard>;
 defaultView?: CardViewMode;
 storageKey?: string;
}){
 const [savedView,changeView]=useCardView(storageKey,defaultView);
 const view=savedView==='large'?'compact':savedView;
 const [point,setPoint]=useState<Point|null>(null);
 const savedLocation=useSavedLocation();
 useEffect(()=>{setPoint(savedLocation);},[savedLocation]);
 const [urlFilters,setFilters]=useUrlFilters(builderDefaults);
 const sort=urlFilters.order;
 const setSort=(order:string)=>setFilters(previous=>({...previous,order}));
 const filters={...urlFilters,location:''};
 const {requestLocation,dialog}=useLocationRequest((location,intent)=>{setPoint(location);if(intent.key==='radius')setFilters(previous=>({...previous,radius:intent.value}));else setSort(intent.value);});
 const change=(key:keyof typeof builderDefaults,value:string)=>{if(key==='radius'&&value){void requestLocation(location=>{setPoint(location);setFilters(previous=>({...previous,radius:value}));},{key:'radius',value});}else setFilters(previous=>({...previous,[key]:value}));};
 const changeSort=(value:string)=>{if(value==='distance'){void requestLocation(location=>{setPoint(location);setSort(value);},{key:'order',value});}else setSort(value);};
 const remote=useDirectoryQuery('builders',urlFilters,point,initial);
 const source=remote?.cards??cards;
 const filtered=remote?source:filterBuilders(source,filters,point);
 const regions=(remote?.facets.region as string[]|undefined)??[...new Set(cards.flatMap(card=>matchingBuilderLocations(card,{...filters,region:''},point).map(location=>location.region??'Unknown')))].sort();
 const ordered=remote?filtered.map(card=>({...card,nearest:point?card.locations.filter(location=>Number.isFinite(location.latitude)&&Number.isFinite(location.longitude)).map(location=>({...location,miles:distanceMiles(point,{latitude:location.latitude!,longitude:location.longitude!})})).sort((a,b)=>a.miles-b.miles)[0]:undefined})):orderedDevelopers(filtered.map(card=>({...card,totalDevelopments:card.totalDevelopments??card.locations.length,locations:matchingBuilderLocations(card,filters,point)})),sort,point);
 useDirectoryCounts(remote?.counts??{Builders:ordered.length,Developments:new Set(ordered.flatMap(card=>card.locations.map(location=>location.key??`${card.slug}:${location.name}`))).size,'Building types':new Set(ordered.flatMap(card=>card.locations.flatMap(location=>(location.buildingTypes??[]).map(type=>`${card.slug}:${type}`)))).size});
 const imageLayout=`${view}:${ordered.map(c=>c.slug).join(",")}`;
 return <section aria-label="Builder collections" aria-busy={remote?.loading}>{dialog}<DirectoryQueryStatus query={remote}/>
  <div className="site-filter-panel builder-filter-panel">
   <DirectoryFilters pending={Boolean(remote?.loading)} className="filters" label="Builder filters">
    <DistanceFilter label="Developments Within" value={filters.radius} location={savedLocation} onChange={value=>change('radius',value)} onChangeLocation={()=>{void requestLocation(location=>setPoint(location),{key:'radius',value:filters.radius},true);}}/>
    <MultiSelectFilter label="Development Locations" value={filters.region} options={regions} onChange={value=>change('region',value)}/>
    <button type="button" className="location-filter-reset" onClick={()=>setFilters(builderDefaults)}>Reset</button>
   </DirectoryFilters>

  </div>
  <div className="directory-toolbar"><ViewOptions view={view} onChange={changeView} ariaLabel="Collection layout" hideLarge/><div className="sort-control"><span>Order by</span><SingleSelectFilter label="Order builders by" value={sort} onChange={changeSort} options={[{value:'name',label:'Name Asc'},{value:'name-desc',label:'Name Desc'},{value:'spaces',label:'Most interiors'},{value:'distance',label:'Nearest distance'}]}/></div></div><CardResults className={`collection-grid directory-${view}`} label="Builders" identity={JSON.stringify([urlFilters,sort])} hasMore={remote?.hasMore} loading={remote?.loading} onLoadMore={remote?.loadMore}>{ordered.map(card=><a className="collection-card builder-card" key={card.slug} href={`/builders/${card.slug}`} aria-label={`Explore ${card.name}`} ><ScrollCollectionImage images={card.images} image={card.image} description={card.description} layout={imageLayout} showBuilderLogo/><div className="card-body"><h2><BuilderName name={card.name}/><span aria-hidden="true">↗</span></h2><dl className="builder-card-facts"><div><dt>HBF Rating</dt><dd title={card.rating?`HBF composite satisfaction score: ${card.rating.score}, rounded to ${card.rating.value}. Source: ${card.rating.source}`:'No verified HBF rating available'}>{card.rating?<><span className="builder-rating-houses" aria-hidden="true">{Array.from({length:Math.ceil(card.rating.value)},(_,index)=><svg key={index} width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path opacity="0.2" d="M12 3 2 11h3v10h5v-7h4v7h5V11h3L12 3Z"/><path style={{clipPath:card.rating!.value-index<1?'inset(0 50% 0 0)':undefined}} d="M12 3 2 11h3v10h5v-7h4v7h5V11h3L12 3Z"/></svg>)}</span><span className="sr-only">HBF satisfaction score {card.rating.value} out of 5</span></>:'Not available'}</dd></div><div><dt>Ratings</dt><dd title={card.reviews?`Review-count-weighted average. ${card.reviews.sources.map(source=>`${source.name}: ${source.rating}/5 from ${source.count.toLocaleString('en-GB')} reviews; checked ${source.checkedAt}. Source: ${source.url}`).join(' | ')}`:'No verified review ratings available'}>{card.reviews?`${card.reviews.average.toFixed(1)} (${card.reviews.count.toLocaleString('en-GB')})`:'Not available'}</dd></div></dl><p>{card.locations.length.toLocaleString('en-GB')} Site Developments{card.locations.length<(card.totalDevelopments??card.locations.length)?' in range':''}</p>{sort==='distance'&&point&&<p className="subtle">{card.nearest?`${card.nearest.miles.toFixed(1)} miles · ${card.nearest.name}`:'Location unavailable'}</p>}</div></a>)}</CardResults>{!ordered.length&&<p className="empty">No builders match these filters. Try widening your search.</p>}</section>;
}
