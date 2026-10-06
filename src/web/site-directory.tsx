'use client';
import {useDirectoryQuery,DirectoryQueryStatus} from './use-directory-query';
import type {DirectoryPageData} from './directory-page-data';
import {anyBedrooms,bedroomRangeOptions} from './bedroom-range';
import {priceRangeOptions} from './price-range';
import {compareDevelopmentPrices} from './development-price-order';
import {SingleSelectFilter} from './single-select-filter';
import {MoneyInput} from './money-input';
import {CardResults} from './card-results';
import {usePublishDirectoryMapCards,useDirectoryCounts} from './directory-counts';
import {DistanceFilter} from './distance-filter';
import {MultiSelectFilter} from './multi-select-filter';
import {useLocationRequest} from './location-dialog';
import {useSavedLocation} from './location-preferences';
import {DirectoryFilters} from './directory-filters';
import {BuilderName} from './builder-name';
import {builderBrand} from './builder-brand';
import Link from 'next/link';
import {useState,useEffect,useMemo,lazy,Suspense,useRef} from 'react';
import {hasCoordinates,type MapCamera} from './map-coordinates';
import type {FocusArea} from './map-marker-visibility';
import {developers as builderRegistry} from '../adapters/developers';
const SiteMap=lazy(()=>import('./site-map').then(module=>({default:module.SiteMap})));
import {useUrlFilters} from './url-filters';
import {ScrollCollectionImage,type CollectionImage} from './scroll-collection-image';
import {sitePropertyFacet,filterSites,type SiteCard,type SiteFilters,type LocationPoint} from './site-filters';
import {ViewOptions,useCardView,type CardViewMode} from './view-options';
const defaults:SiteFilters={developer:'',country:'',region:'',location:'',minPrice:'',maxPrice:'',minBeds:'',maxBeds:'',style:'',radius:''};
const urlDefaults={...defaults,minBeds:anyBedrooms,maxBeds:anyBedrooms,minPrice:'any',maxPrice:'any',postcode:'',order:'',view:'',selected:'',lat:'',lng:'',zoom:''};
const money=(n:number)=>'£'+n.toLocaleString('en-GB');
function range(values:(number|null)[],format:(n:number)=>string){const known=values.filter((v):v is number=>v!==null&&Number.isFinite(v));if(!known.length)return 'Not available';const min=Math.min(...known),max=Math.max(...known);return min===max?format(min):`${format(min)} – ${format(max)}`;}
export function SiteDirectory({
 cards,
 initial,
 basePath = '/developments',
 defaultView = 'list',
 storageKey = 'showhome-locations-view',
}:{
 cards:SiteCard[];
 initial?:DirectoryPageData<SiteCard>;
 basePath?: string;
 defaultView?: CardViewMode|'map';
 storageKey?: string;
}){
 const [visibleKeys,setVisibleKeys]=useState<string[]>([]);
 const [hasMapBounds,setHasMapBounds]=useState(false);
 const [searchMap,setSearchMap]=useState(true);
 const [focusSequence,setFocusSequence]=useState(0);
 const [hoverKey,setHoverKey]=useState<string|null>(null);
 const resultsPanel=useRef<HTMLDivElement>(null);
 const explorerPanel=useRef<HTMLDivElement>(null);
 const [sheetExpanded,setSheetExpanded]=useState(false);
 const sheetStart=useRef<number|null>(null);
 const [mapUnavailable,setMapUnavailable]=useState(false);
 const [focusArea,setFocusArea]=useState<FocusArea|undefined>(undefined);
 const [savedView,saveView]=useCardView(storageKey,defaultView==='map'?'compact':defaultView);
 const [urlFilters,setUrlFilters,filtersReady]=useUrlFilters(urlDefaults);
 const mapView=urlFilters.view==='map'||(!urlFilters.view&&defaultView==='map');
 const view:CardViewMode=['list','large','compact'].includes(urlFilters.view)?urlFilters.view as CardViewMode:savedView;
 const activeKey=urlFilters.selected||null;
 const camera:MapCamera|undefined=urlFilters.lat&&urlFilters.lng&&urlFilters.zoom&&Number.isFinite(Number(urlFilters.lat))&&Math.abs(Number(urlFilters.lat))<=85&&Number.isFinite(Number(urlFilters.lng))&&Math.abs(Number(urlFilters.lng))<=180&&Number(urlFilters.zoom)>=0&&Number(urlFilters.zoom)<=22?{lat:Number(urlFilters.lat),lng:Number(urlFilters.lng),zoom:Number(urlFilters.zoom)}:undefined;
 function changeView(next:CardViewMode){saveView(next);setUrlFilters(previous=>({...previous,view:next}));}
 function updateCamera(next:MapCamera){setUrlFilters(previous=>({...previous,lat:next.lat.toFixed(5),lng:next.lng.toFixed(5),zoom:next.zoom.toFixed(2)}));}
 useEffect(()=>{
  if(!mapView)return;
  const measure=()=>{const element=explorerPanel.current;if(element)element.style.setProperty('--explorer-height',Math.max(360,window.innerHeight-element.getBoundingClientRect().top-20)+'px');};
  measure();window.addEventListener('resize',measure);document.addEventListener('toggle',measure,true);
  return()=>{window.removeEventListener('resize',measure);document.removeEventListener('toggle',measure,true);};
 },[mapView]);
 useEffect(()=>{
  if(!mapView){setFocusArea(undefined);return;}
  const computeFocus=()=>{
   const explorer=explorerPanel.current;
   const preview=resultsPanel.current;
   if(!explorer)return;
   const expRect=explorer.querySelector('.site-map-panel')?.getBoundingClientRect()??explorer.getBoundingClientRect();
   const toolbar=explorer.parentElement?.querySelector('.location-explorer-toolbar')?.getBoundingClientRect();
   const header=document.querySelector('.site-header')?.getBoundingClientRect();
   const footer=document.querySelector('body>footer')?.getBoundingClientRect();
   const top=Math.max(header?.bottom??0,toolbar?.bottom??0)+12;
   explorer.parentElement?.style.setProperty('--map-content-top',top+'px');
   explorer.parentElement?.style.setProperty('--map-header-bottom',(header?.bottom??0)+'px');
   const floor=footer?Math.min(expRect.bottom,footer.top):expRect.bottom;
   explorer.parentElement?.style.setProperty('--map-footer-height',(footer?.height??48)+'px');
   const isMobile=window.innerWidth<=900;
   if(isMobile){
    const prevRect=preview?.getBoundingClientRect();
    const bottomHeight=prevRect?Math.min(expRect.height-80,prevRect.height):150;
    setFocusArea({
     left:12,
     top:top-expRect.top,
     right:Math.max(24,expRect.width-12),
     bottom:Math.max(top+40-expRect.top,(prevRect?.top??floor)-expRect.top-12)
    });
   }else{
    const prevWidth=preview?preview.getBoundingClientRect().right-expRect.left:440;
    setFocusArea({
     left:prevWidth+24,
     top:top-expRect.top,
     right:Math.max(prevWidth+60,expRect.width-16),
     bottom:Math.max(top+40-expRect.top,floor-expRect.top-12)
    });
   }
  };
  computeFocus();
  const observer=new ResizeObserver(computeFocus);if(resultsPanel.current)observer.observe(resultsPanel.current);const header=document.querySelector('.site-header');if(header)observer.observe(header);const footer=document.querySelector('body>footer');if(footer)observer.observe(footer);const filters=explorerPanel.current?.parentElement?.querySelector('.location-filter-panel');if(filters)observer.observe(filters);
  window.addEventListener('resize',computeFocus);
  return()=>{observer.disconnect();window.removeEventListener('resize',computeFocus);};
 },[mapView,sheetExpanded]);
 const filters:SiteFilters=useMemo(()=>({developer:urlFilters.developer,country:'',region:'',location:'',minPrice:urlFilters.minPrice==='any'?'':urlFilters.minPrice,maxPrice:urlFilters.maxPrice==='any'?'':urlFilters.maxPrice,minBeds:urlFilters.minBeds===anyBedrooms?'':urlFilters.minBeds,maxBeds:urlFilters.maxBeds===anyBedrooms?'':urlFilters.maxBeds,style:'',radius:urlFilters.radius}),[urlFilters.developer,urlFilters.country,urlFilters.region,urlFilters.location,urlFilters.minPrice,urlFilters.maxPrice,urlFilters.minBeds,urlFilters.maxBeds,urlFilters.style,urlFilters.radius]);
 const setFilters=(value:SiteFilters|((previous:SiteFilters)=>SiteFilters))=>setUrlFilters(previous=>({...previous,...(typeof value==='function'?value(previous):value)}));
 const [point,setPoint]=useState<LocationPoint|null>(null);
 const savedLocation=useSavedLocation();
 const order=urlFilters.order||(point?'distance':'name');
 const {requestLocation,dialog}=useLocationRequest((location,intent)=>{setPoint(location);setUrlFilters(previous=>({...previous,[intent.key]:intent.value}));});
 useEffect(()=>{setPoint(savedLocation);},[savedLocation]);
 const setOrder=(value:string)=>{if(value==='distance'){void requestLocation(location=>{setPoint(location);setUrlFilters(previous=>({...previous,order:value}));},{key:'order',value});}else setUrlFilters(previous=>({...previous,order:value}));};
 function change(key:keyof SiteFilters,value:string){if(key==='radius'&&value){void requestLocation(location=>{setPoint(location);setFilters(previous=>({...previous,radius:value}));},{key:'radius',value});}else setFilters(previous=>({...previous,[key]:value,...(key==='minBeds'&&value&&value!==anyBedrooms&&previous.maxBeds&&previous.maxBeds!==anyBedrooms&&Number(previous.maxBeds)<Number(value)?{maxBeds:value}:{}),...(key==='minPrice'&&value&&value!=='any'&&previous.maxPrice&&previous.maxPrice!=='any'&&Number(previous.maxPrice)<Number(value)?{maxPrice:value}:{}),...(key==='maxPrice'&&value&&value!=='any'&&previous.minPrice&&previous.minPrice!=='any'&&Number(previous.minPrice)>Number(value)?{minPrice:value}:{})}));}
 const invalid=(filters.minPrice!==''&&filters.maxPrice!==''&&Number(filters.minPrice)>Number(filters.maxPrice))||(filters.minBeds!==''&&filters.maxBeds!==''&&Number(filters.minBeds)>Number(filters.maxBeds));
 const remote=useDirectoryQuery('locations',{...urlFilters,order},point,initial,mapView&&searchMap&&!mapUnavailable&&hasMapBounds?visibleKeys:undefined,mapView?activeKey??undefined:undefined,filtersReady);
 const matching=useMemo(()=>remote?remote.cards.map(card=>({...card,miles:(card as SiteCard&{miles?:number|null}).miles??null})):(invalid?[]:filterSites(cards,filters,point)).sort((a,b)=>order==='price-asc'||order==='price-desc'?compareDevelopmentPrices(a,b,filters,order==='price-desc'):order==='distance'&&point?(a.miles??Infinity)-(b.miles??Infinity)||a.name.localeCompare(b.name):order==='name-desc'?b.name.localeCompare(a.name):a.name.localeCompare(b.name)),[cards,invalid,filters,point,order,remote?.cards]);
 const mapMatching=remote?.mapCards??matching;
 const visible=!remote&&mapView&&searchMap&&!mapUnavailable?matching.filter(card=>visibleKeys.includes(card.key)):matching;
 const unmapped=mapMatching.filter(card=>!hasCoordinates(card)).length;
 function selectCard(key:string){setFocusSequence(value=>value+1);selectSite(key);}
 function selectSite(key:string){setUrlFilters(previous=>({...previous,selected:key}));setSheetExpanded(true);requestAnimationFrame(()=>{const card=document.getElementById('site-card-'+key),panel=resultsPanel.current;if(card&&panel){const isMobile=typeof window!=='undefined'&&window.innerWidth<=900;if(isMobile){card.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',inline:'center',block:'nearest'});}else{const rect=card.getBoundingClientRect(),parent=panel.getBoundingClientRect();panel.scrollTo?.({top:panel.scrollTop+rect.top-parent.top-12,behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}}});}
 useEffect(()=>{if(activeKey&&!mapMatching.some(card=>card.key===activeKey))setUrlFilters(previous=>({...previous,selected:''}));},[mapMatching,activeKey]);
 const facet=(key:keyof SiteFilters)=>filterSites(cards,{...filters,[key]:''},point);
 const bedroomProperties=sitePropertyFacet(cards,filters,point,'bedrooms');
 const bedroomCounts=(remote?.facets.beds as number[]|undefined)??[...new Set(bedroomProperties.map(property=>property.bedrooms).filter((count):count is number=>count!==null&&Number.isInteger(count)&&count>0))].sort((a,b)=>a-b);
 const priceProperties=sitePropertyFacet(cards,filters,point,'price');
 const priceRange=priceRangeOptions(remote?((remote.facets.price??[]) as number[]):priceProperties.map(property=>property.price).filter((price):price is number=>price!==null));
 const minimumPrice=filters.minPrice;
 const maximumPrice=filters.maxPrice;
 const bedroomRange=bedroomRangeOptions(bedroomCounts,urlFilters.minBeds,urlFilters.maxBeds);
 const developers=(remote?.facets.developer as string[]|undefined)??[...new Set(facet('developer').map(c=>c.developer))].sort();
 useEffect(()=>{if(!mapView||!activeKey)return;const element=document.getElementById('site-card-'+activeKey),panel=resultsPanel.current;if(element&&panel){const isMobile=typeof window!=='undefined'&&window.innerWidth<=900;if(isMobile){element.scrollIntoView({behavior:'auto',inline:'center',block:'nearest'});}else{const top=element.getBoundingClientRect().top-panel.getBoundingClientRect().top+panel.scrollTop;panel.scrollTo?.({top:Math.max(0,top-12),behavior:'auto'});}}},[activeKey,mapView,visible.map(c=>c.key).join(',')]);
 useEffect(()=>{if(!mapView)return;const panel=resultsPanel.current;if(!panel)return;const isMobile=typeof window!=='undefined'&&window.innerWidth<=900;if(!isMobile)return;const grid=panel.querySelector('.collection-grid');if(!grid)return;let timer:ReturnType<typeof setTimeout>;let userScrolled=false;const onPointerDown=()=>{userScrolled=true;};const onScroll=()=>{if(!userScrolled)return;clearTimeout(timer);timer=setTimeout(()=>{const gridRect=grid.getBoundingClientRect();const centerX=gridRect.left+gridRect.width/2;const cards=grid.querySelectorAll<HTMLElement>('.collection-card');let closestKey:string|null=null,minDist=Infinity;cards.forEach(card=>{const rect=card.getBoundingClientRect();const cardCenter=rect.left+rect.width/2;const dist=Math.abs(cardCenter-centerX);if(dist<minDist){minDist=dist;const key=card.id.replace('site-card-','');if(key)closestKey=key;}});userScrolled=false;if(closestKey&&minDist<gridRect.width*0.45){setUrlFilters(prev=>prev.selected===closestKey?prev:({...prev,selected:closestKey!}));}},120);};grid.addEventListener('pointerdown',onPointerDown,{passive:true});grid.addEventListener('scroll',onScroll,{passive:true});return()=>{clearTimeout(timer);grid.removeEventListener('pointerdown',onPointerDown);grid.removeEventListener('scroll',onScroll);};},[mapView,visible.map(c=>c.key).join(',')]);
 const imageLayout=`${view}:${visible.map(c=>c.key).join(",")}`;
 useDirectoryCounts(remote?.counts??{Developments:visible.length});
 usePublishDirectoryMapCards(mapMatching,!remote?.pendingInitial);
 return <section aria-label="Filter developments" aria-busy={remote?.loading}>{dialog}
 <div className="site-filter-panel location-filter-panel">
 <DirectoryFilters pending={Boolean(remote?.loading)} className="filters site-filters location-primary-filters" label="Development filters">
  <MultiSelectFilter label="Builders" value={filters.developer} options={developers} onChange={value=>change('developer',value)}/>
  <DistanceFilter label="Within Distance" value={filters.radius} location={savedLocation} onChange={value=>change('radius',value)} onChangeLocation={()=>{void requestLocation(location=>setPoint(location),{key:'radius',value:filters.radius},true);}}/>
  <fieldset className="development-range-filter"><legend>Bedrooms range</legend><div>
   <SingleSelectFilter label="Minimum bedrooms" value={bedroomRange.minValue} options={[{value:'',label:'Any'},...bedroomRange.minNumbers.map(count=>({value:String(count),label:`${count} ${count===1?'bed':'beds'}`}))]} onChange={value=>change('minBeds',value||anyBedrooms)}/>
   <span aria-hidden="true">–</span>
   <SingleSelectFilter label="Maximum bedrooms" value={bedroomRange.maxValue} options={[{value:'',label:'Any'},...bedroomRange.maxNumbers.map(count=>({value:String(count),label:`${count} ${count===1?'bed':'beds'}`}))]} onChange={value=>change('maxBeds',value||anyBedrooms)}/>
  </div></fieldset>
  <fieldset className="development-range-filter"><legend>Price range (£)</legend><div>
   <MoneyInput label="Minimum price" value={minimumPrice} options={priceRange.options.filter(price=>!maximumPrice||price<=Number(maximumPrice))} onChange={value=>change('minPrice',value||'any')}/>
   <span aria-hidden="true">–</span>
   <MoneyInput label="Maximum price" value={maximumPrice} options={priceRange.options.filter(price=>!minimumPrice||price>=Number(minimumPrice))} onChange={value=>change('maxPrice',value||'any')}/>
  </div></fieldset>
  <button className="location-filter-reset" type="button" onClick={()=>{setUrlFilters(previous=>({...urlDefaults,view:previous.view,lat:previous.lat,lng:previous.lng,zoom:previous.zoom}));}}>Reset</button>
 </DirectoryFilters>
 {invalid&&<p role="alert" className="error">Minimum price and bedrooms must not exceed their maximum values.</p>}
 </div>
<div className="directory-toolbar location-explorer-toolbar">
 <div className="directory-view-status"><div className="location-view-controls"><ViewOptions view={mapView?'map':view} onChange={changeView} ariaLabel="Developments layout"/><button type="button" className="location-map-toggle" aria-label="Map" aria-pressed={mapView} onClick={()=>{setMapUnavailable(false);setUrlFilters(previous=>({...previous,view:'map'}));}}>▧ <span>Map</span></button></div>
 <DirectoryQueryStatus query={remote} visible/></div>
 <div className="development-order"><span>Order by</span><SingleSelectFilter label="Order developments by" value={order} options={[{value:'name',label:'Name Asc'},{value:'name-desc',label:'Name Desc'},{value:'price-asc',label:'Price Asc'},{value:'price-desc',label:'Price Desc'},{value:'distance',label:'Nearest first'}]} onChange={setOrder}/></div>
 {mapView&&<label className="site-map-search"><input type="checkbox" checked={searchMap} onChange={e=>setSearchMap(e.target.checked)}/> Search as I move</label>}
 </div>
 <div ref={explorerPanel} className={mapView?'site-map-directory location-explorer'+(sheetExpanded?' sheet-expanded':''):'location-directory'}>
 {mapView&&<Suspense fallback={<aside className="site-map-panel"><p className="empty">Loading map…</p></aside>}><SiteMap cards={mapMatching} activeKey={activeKey} focusSequence={focusSequence} hoverKey={hoverKey} camera={camera} onCameraChange={updateCamera} onBoundsChange={()=>setMapUnavailable(false)} onVisibleSitesChange={keys=>{setHasMapBounds(true);setVisibleKeys(keys);}} onSelect={selectSite} onUnavailable={()=>setMapUnavailable(true)} focusArea={focusArea}/></Suspense>}
 <div className="site-preview-panel" ref={resultsPanel}>
 {mapView&&<button className="site-sheet-handle" type="button" aria-expanded={sheetExpanded} aria-label={sheetExpanded?'Collapse development previews':'Expand development previews'} onClick={()=>setSheetExpanded(value=>!value)} onTouchStart={e=>{sheetStart.current=e.touches[0]?.clientY??null;}} onTouchEnd={e=>{const y=e.changedTouches[0]?.clientY;if(sheetStart.current!==null&&y!==undefined&&Math.abs(y-sheetStart.current)>20)setSheetExpanded(y<sheetStart.current);sheetStart.current=null;}}><span/><b>{visible.length} developments · {sheetExpanded?'Show map':'View previews'}</b></button>}
 <CardResults className={`collection-grid directory-${mapView?'compact':view}`} label="Developments" identity={JSON.stringify([filters,order])} paginate={!mapView} hasMore={remote?.hasMore} loading={remote?.loading} onLoadMore={remote?.loadMore}>
 {visible.map(card=>{
 const href=card.href??`${basePath}/${card.key}`;
 const content=<><div className="site-preview-photo">{card.image?<ScrollCollectionImage images={card.images} image={card.image} description={card.description} layout={imageLayout} caption={mapView}/>:<div className="development-image-pending">Images not yet available</div>}<>{card.logo&&<img className="development-builder-logo" style={{background:card.logoBackground??'#fff'}} src={card.logo} alt={`${card.developer} logo`} loading="lazy"/>}</></div><div className="card-body"><h2>{card.name}</h2><p className="site-builder-line"><BuilderName name={card.developer}/></p><p className="subtle development-location">{[card.country,card.town].filter(Boolean).join(', ')||'Location unavailable'}{point&&<> · {card.miles===null?'Distance unavailable':`${card.miles.toFixed(1)} miles away`}</>}</p><dl className={`site-property-summary${mapView?' site-compact-facts':''}`}><div><dt>Prices</dt><dd>{range(card.properties.map(p=>p.price),money)}</dd></div><div><dt>Bedrooms</dt><dd>{range(card.properties.map(p=>p.bedrooms),String)}</dd></div><div className="site-style-fact"><dt>Styles</dt><dd>{[...new Set(card.properties.map(p=>p.style??'Unknown'))].map(style=><span className="development-style" key={style}>{style}</span>)}</dd></div></dl></div></>;
 const className=`collection-card${activeKey===card.key?' is-map-active':''}${hoverKey===card.key?' is-map-hovered':''}`;
 return <Link prefetch={false} id={'site-card-'+card.key} key={card.key} className={className} href={href} onMouseEnter={()=>setHoverKey(card.key)} onMouseLeave={()=>setHoverKey(null)} onFocus={()=>setHoverKey(card.key)} onBlur={()=>setHoverKey(null)}>{content}</Link>;
 })}
 </CardResults>
 {remote?.loading&&!visible.length&&<p className="empty" role="status">Loading matching developments…</p>}
 {!remote?.loading&&!remote?.error&&!visible.length&&<p className="empty">{mapView?'No developments in this area match your filters. Move the map or show all matching sites.':'No developments match your filters. Try widening your search.'}</p>}
 {mapView&&unmapped>0&&<p className="subtle site-unmapped">{unmapped} matching {unmapped===1?'development has':'developments have'} no map coordinates. Browse List or Cards to see them.</p>}
 </div></div></section>;
}
