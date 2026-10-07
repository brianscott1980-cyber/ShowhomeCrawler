'use client';
import {cascadingFiltersEnabled} from './filter-settings';
import {homeTypeName} from '../reports/home-display';
import {roomLabel} from './shared-image-cards';
import {useDirectoryQuery,DirectoryQueryStatus} from './use-directory-query';
import type {DirectoryPageData} from './directory-page-data';
import {CardResults} from './card-results';
import {SingleSelectFilter} from './single-select-filter';
import {useDirectoryCounts} from './directory-counts';
import {MultiSelectFilter} from './multi-select-filter';
import {matchesAnySelection} from './filter-selection';
import {DirectoryFilters} from './directory-filters';
import {BuilderName} from './builder-name';
import {useUrlFilters} from './url-filters';
const filterDefaults={developer:'',bedrooms:'',location:'',site:'',type:'',building:'',order:'name'};
import {matchesBuildingPlace,type BuildingPlace} from './building-place-filter';
import {ScrollCollectionImage,type CollectionImage} from './scroll-collection-image';
import Link from 'next/link';
import {ViewOptions,useCardView,type CardViewMode} from './view-options';

export interface GroupCardItem {
 key: string;
 href?: string;
 logo?:string;
 logoBackground?:string;
 name: string;
 developers: string[];
 count: number;
 interiorIds?:string[];
 images?: CollectionImage[];
 image: string;
 description: string;
 bedrooms?: number[];
 locations?: string[];
 sites?: string[];
 places?: (BuildingPlace & {siteId?:string;imageIds?:string[]})[];
}

export function GroupCards({
 cards,
 initial,
 pathPrefix,
 kindLabel,
 defaultView = pathPrefix === 'buildings' ? 'compact' : 'large',
 storageKey = pathPrefix === 'buildings' ? 'showhome-buildings-view' : 'showhome-interiors-view',
}: {
 cards: GroupCardItem[];
 initial?:DirectoryPageData<GroupCardItem>;
 pathPrefix: string;
 kindLabel: string;
 defaultView?: CardViewMode;
 storageKey?: string;
}) {
 const [view, changeView] = useCardView(storageKey, defaultView, pathPrefix==='buildings'?'list':undefined);
 const [savedFilters,setFilters]=useUrlFilters(filterDefaults);
 const filters=pathPrefix==='interiors'?{...savedFilters,type:''}:savedFilters;
 const {developer,bedrooms,location,site}=filters;
 const setDeveloper=(value:string)=>setFilters(previous=>({...previous,developer:value,...(cascadingFiltersEnabled()&&pathPrefix==='interiors'?{site:'',building:''}:{})}));
 const setBedrooms=(value:string)=>setFilters(previous=>({...previous,bedrooms:value}));
 const setLocation=(value:string)=>setFilters(previous=>({...previous,location:value}));
 const setSite=(value:string)=>setFilters(previous=>({...previous,site:value,...(cascadingFiltersEnabled()&&pathPrefix==='interiors'?{building:''}:{})}));

 const isBuildings = pathPrefix === 'buildings';
 const remote=useDirectoryQuery(isBuildings?'buildings':'interiors',filters,null,initial);

 const placeMatches=(card:GroupCardItem,place:BuildingPlace,omit='')=>
  Boolean(omit&&!cascadingFiltersEnabled())||
  (omit==='developer'||!place.developer||matchesAnySelection(developer,[place.developer]))&&
  (omit==='bedrooms'||matchesAnySelection(bedrooms,place.bedrooms===undefined?(card.bedrooms??[]).map(String):[String(place.bedrooms)]))&&
  matchesBuildingPlace([place],omit==='site'?'':site,omit==='location'?'':location);
 const matches=(card:GroupCardItem,omit='')=>{
  if(omit!=='developer'&&!matchesAnySelection(developer,card.developers))return false;
  if(omit!=='type'&&!matchesAnySelection(filters.type,[card.name]))return false;
  if(omit!=='bedrooms'&&!matchesAnySelection(bedrooms,(card.bedrooms??[]).map(String)))return false;
  if(((omit!=='site'&&site)||(omit!=='location'&&location)||(omit!=='bedrooms'&&bedrooms))&&!(card.places??[]).some(place=>placeMatches(card,place,omit)))return false;
  return true;
 };
 const facet=(key:string)=>!cascadingFiltersEnabled()?cards:cards.filter(card=>matches(card,key));
 const developers=(remote?.facets.developer as string[]|undefined)??[...new Set(facet('developer').flatMap(c=>(cascadingFiltersEnabled()&&(site||location||bedrooms))?(c.places??[]).filter(place=>placeMatches(c,place,'developer')).flatMap(place=>place.developer?[place.developer]:c.developers):c.developers))].sort();
 const bedroomOptions=(remote?.facets.bedrooms as number[]|undefined)??[...new Set(facet('bedrooms').flatMap(c=>(c.places??[]).filter(place=>placeMatches(c,place,'bedrooms')).flatMap(place=>place.bedrooms===undefined?c.bedrooms??[]:[place.bedrooms])))].sort((a,b)=>a-b);
 const locationOptions=(remote?.facets.location as string[]|undefined)??[...new Set(facet('location').flatMap(c=>(c.places??[]).filter(place=>placeMatches(c,place,'location')).flatMap(place=>place.locations)))].sort();
 const siteOptions=(remote?.facets.site as string[]|undefined)??[...new Set(facet('site').flatMap(c=>(c.places??[]).filter(place=>placeMatches(c,place,'site')).map(place=>place.site)))].sort();
 const buildingOptions=(remote?.facets.building as string[]|undefined)??[];
 const typeOptions=(remote?.facets.type as string[]|undefined)??[...new Set(facet('type').map(c=>c.name))].sort();
 const visible=remote?.cards??cards.filter(card=>matches(card)).sort((a,b)=>filters.order==='name-desc'?b.name.localeCompare(a.name):a.name.localeCompare(b.name));

 const rooms=visible.filter(card=>!['Exterior','Uncategorised'].includes(card.name));
 const matchingPlaces=visible.flatMap(card=>(card.places??[]).filter(place=>placeMatches(card,place)));
 useDirectoryCounts(remote?.counts??(isBuildings?{Styles:visible.length,Developments:new Set(matchingPlaces.map(place=>place.siteId??`${place.developer}:${place.site}`)).size}:{'Room Types':rooms.length,Interiors:new Set(rooms.flatMap(card=>(developer||bedrooms||location||site)?(card.places??[]).filter(place=>placeMatches(card,place)).flatMap(place=>place.imageIds??[]):card.interiorIds??[])).size}),Boolean(remote?.loading));
 const isInteriors = pathPrefix === 'interiors' || pathPrefix === 'spaces';
 const allRoomCard: GroupCardItem | null = isInteriors && visible.length > 1 ? {
  key: 'all',
  name: 'All Room Types',
  href: `/${pathPrefix}/all`,
  description: 'Explore showhome interiors across all room types.',
  count: remote?.counts?.['Interiors'] ?? visible.reduce((sum, c) => sum + (c.count ?? 0), 0),
  image: visible.find(c => c.images?.[0]?.src || c.image)?.image ?? visible[0]?.image ?? '',
  images: visible.flatMap(c => (c.images && c.images.length > 0 ? [c.images[0]!] : c.image ? [{alt: c.name, src: c.image, roomType: c.name}] : [])).slice(0, 12),
  developers: [...new Set(visible.flatMap(c => c.developers ?? []))],
 } : null;
 const displayCards = allRoomCard ? [allRoomCard, ...visible] : visible;
 const imageLayout=`${view}:${displayCards.map(c=>c.key).join(",")}`;

 const hasActiveFilters = Boolean(developer || bedrooms || location || site || filters.type || filters.building);
 function resetFilters() { setFilters(filterDefaults); }

 return (
  <>
   {(
    <div className={`site-filter-panel${isBuildings?'':' interior-filter-panel'}`} style={{marginBottom: 24}}>
     <DirectoryFilters pending={Boolean(remote?.loading)} className="filters site-filters" label={`Filter ${kindLabel.toLowerCase()}`}>
      <MultiSelectFilter label="Builders" value={developer} options={developers} onChange={setDeveloper}/>
      {isBuildings&&<MultiSelectFilter label="Styles" value={filters.type} options={typeOptions} onChange={value=>setFilters(previous=>({...previous,type:value}))}/>}
      {isBuildings?<>
      <MultiSelectFilter label="Bedrooms" value={bedrooms} options={bedroomOptions.map(b=>({value:String(b),label:`${b} bedrooms`}))} onChange={setBedrooms}/>
      <MultiSelectFilter label="Areas" value={location} options={locationOptions} onChange={setLocation}/>
      <MultiSelectFilter label="Developments" value={site} options={siteOptions} onChange={setSite}/>
      </>:<>
      <MultiSelectFilter label="Developments" value={site} options={siteOptions} onChange={setSite}/>
      <MultiSelectFilter label="Building Types" value={filters.building} options={buildingOptions.map(name=>({value:name,label:homeTypeName(name).replace(/\b\w/g,letter=>letter.toUpperCase())}))} onChange={building=>setFilters(previous=>({...previous,building}))}/>
      </>}
      {hasActiveFilters && (
       <button
        type="button"
        disabled={cascadingFiltersEnabled()&&Boolean(remote?.loading)}
        onClick={resetFilters}
        className="location-filter-reset"
       >
        Reset
       </button>
      )}
     </DirectoryFilters>
    </div>
   )}
   <div className={`directory-toolbar${isBuildings?' buildings-directory-toolbar':''}`}>
    <div className="directory-view-status"><ViewOptions view={view} onChange={changeView} ariaLabel={`${kindLabel} layout`} />
    <DirectoryQueryStatus query={remote} visible/></div>
    <div className="sort-control"><span>Order by</span><SingleSelectFilter label={`Order ${kindLabel.toLowerCase()} by`} value={filters.order} options={[{value:'name',label:'Name Asc'},{value:'name-desc',label:'Name Desc'}]} onChange={order=>setFilters(previous=>({...previous,order}))}/></div>
   </div>
   <CardResults className={`collection-grid directory-${view}`} label={isBuildings?"Buildings":"Interiors"} identity={JSON.stringify(filters)} hasMore={remote?.hasMore} loading={remote?.loading} replacing={remote?.replacing} onLoadMore={remote?.loadMore}>
    {displayCards.map(card => (
     <Link prefetch={false} className="collection-card" href={card.href ?? `/${pathPrefix}/${card.key}`} data-filters={JSON.stringify({developer,bedrooms,location,site,building:filters.building})} key={card.key}>
      <div className="site-preview-photo group-preview-photo"><ScrollCollectionImage images={card.images} image={card.image} description={card.description} layout={imageLayout}/>{isBuildings&&card.logo&&<img className="development-builder-logo" src={card.logo} alt={`${card.developers[0]??'Builder'} logo`} style={{background:card.logoBackground??'#fff'}} loading="lazy"/>}</div>
      <div className="card-body">
       <h2>{card.key==='all'?'All Room Types':(isBuildings?homeTypeName(card.name):roomLabel(card.name))}</h2>
       {pathPrefix!=='interiors'&&pathPrefix!=='spaces'&&<p className="subtle">{card.developers.map((name,i)=><span key={name}>{i>0?' · ':''}<BuilderName name={name}/></span>)}</p>}
       {card.bedrooms && card.bedrooms.length > 0 && (
        <p className="subtle">
         {card.bedrooms.map(b => `${b} bed`).join(' · ')}
         {card.sites && card.sites.length > 0 && ` · ${card.sites.length === 1 ? card.sites[0] : `${card.sites.length} sites`}`}
        </p>
       )}
       <p>{card.count} {card.count === 1 ? 'image' : 'images'}</p>
       <span className="subtle">Explore collection →</span>
      </div>
     </Link>
    ))}
   </CardResults>
   {!remote?.loading&&!cards.length && <p className="empty">No {kindLabel.toLowerCase()} available yet.</p>}
   {Boolean(!remote?.loading&&cards.length && !visible.length) && (
    <p className="empty">No {kindLabel.toLowerCase()} match these filters. Try widening your search.</p>
   )}
  </>
 );
}
