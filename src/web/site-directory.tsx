'use client';
import {DirectoryFilters} from './directory-filters';
import {BuilderName} from './builder-name';
import Link from 'next/link';
import {useState,useEffect,useMemo,lazy,Suspense,useRef} from 'react';
import {hasCoordinates,type MapCamera} from './site-map';
import type {FocusArea} from './map-marker-visibility';
import {developers as builderRegistry} from '../adapters/developers';
import logos from '../../public/logos/sources.json';
const SiteMap=lazy(()=>import('./site-map').then(module=>({default:module.SiteMap})));
function builderLogo(name:string){const builder=builderRegistry.find(b=>b.name===name);const logo=logos.find(l=>l.slug===builder?.slug);return logo?'/logos/'+logo.file:undefined;}
import {useUrlFilters} from './url-filters';
import {withFilters} from './url-query';
import {ScrollCollectionImage,type CollectionImage} from './scroll-collection-image';
import {filterSites,type SiteCard,type SiteFilters,type LocationPoint} from './site-filters';
import {ViewOptions,useCardView,type CardViewMode} from './view-options';
const defaults:SiteFilters={developer:'',country:'',minPrice:'',maxPrice:'',minBeds:'',maxBeds:'',style:'',radius:''};
const urlDefaults={...defaults,postcode:'',order:'name',view:'',selected:'',lat:'',lng:'',zoom:''};
const money=(n:number)=>'£'+n.toLocaleString('en-GB');
function range(values:(number|null)[],format:(n:number)=>string){const known=values.filter((v):v is number=>v!==null&&Number.isFinite(v));if(!known.length)return 'Not available';const min=Math.min(...known),max=Math.max(...known);return min===max?format(min):`${format(min)} – ${format(max)}`;}
export function SiteDirectory({
 cards,
 basePath = '/locations',
 defaultView = 'list',
 storageKey = 'showhome-locations-view',
}:{
 cards:SiteCard[];
 basePath?: string;
 defaultView?: CardViewMode|'map';
 storageKey?: string;
}){
 const [visibleKeys,setVisibleKeys]=useState<string[]>([]);
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
 const [urlFilters,setUrlFilters]=useUrlFilters(urlDefaults);
 const {postcode,order}=urlFilters;
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
 const filters:SiteFilters=useMemo(()=>({developer:urlFilters.developer,country:urlFilters.country,minPrice:urlFilters.minPrice,maxPrice:urlFilters.maxPrice,minBeds:urlFilters.minBeds,maxBeds:urlFilters.maxBeds,style:urlFilters.style,radius:urlFilters.radius}),[urlFilters.developer,urlFilters.country,urlFilters.minPrice,urlFilters.maxPrice,urlFilters.minBeds,urlFilters.maxBeds,urlFilters.style,urlFilters.radius]);
 const setFilters=(value:SiteFilters|((previous:SiteFilters)=>SiteFilters))=>setUrlFilters(previous=>({...previous,...(typeof value==='function'?value(previous):value)}));
 const setPostcode=(value:string)=>setUrlFilters(previous=>({...previous,postcode:value}));
 const setOrder=(value:string)=>setUrlFilters(previous=>({...previous,order:value}));
 const [point,setPoint]=useState<LocationPoint|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 function change(key:keyof SiteFilters,value:string){setFilters(previous=>({...previous,[key]:value}));}
 useEffect(()=>{const saved=new URLSearchParams(window.location.search).get('postcode');if(!saved)return;let cancelled=false;fetch('/api/location?postcode='+encodeURIComponent(saved)).then(async r=>{if(!r.ok)return;const p=await r.json();if(!cancelled){setPoint(p);setMessage('Distances from '+p.postcode);}}).catch(()=>{});return()=>{cancelled=true;};},[]);
 async function locate(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setPoint(null);setMessage('Looking up postcode…');try{const response=await fetch('/api/location?postcode='+encodeURIComponent(postcode.trim()));const data=await response.json();if(!response.ok)throw new Error(data.error??'Postcode lookup failed.');setPoint(data);setOrder('distance');setMessage('Distances from '+data.postcode);}catch(error){setMessage(error instanceof Error?error.message:'Location unavailable.');}finally{setBusy(false);}}
 function useLocation(){if(busy)return;if(!navigator.geolocation){setMessage('Location is unavailable. Enter a postcode instead.');return;}setPoint(null);setBusy(true);setMessage('Waiting for your location permission…');navigator.geolocation.getCurrentPosition(p=>{setPoint({latitude:p.coords.latitude,longitude:p.coords.longitude});setBusy(false);setOrder('distance');setMessage('Distances from your current location');},()=>{setBusy(false);setMessage('Location unavailable. Enter a postcode instead.');},{timeout:15000,maximumAge:300000});}
 const invalid=(filters.minPrice!==''&&filters.maxPrice!==''&&Number(filters.minPrice)>Number(filters.maxPrice))||(filters.minBeds!==''&&filters.maxBeds!==''&&Number(filters.minBeds)>Number(filters.maxBeds));
 const matching=useMemo(()=>(invalid?[]:filterSites(cards,filters,point)).sort((a,b)=>order==='distance'&&point?(a.miles??Infinity)-(b.miles??Infinity)||a.name.localeCompare(b.name):a.name.localeCompare(b.name)),[cards,invalid,filters,point,order]);
 const visible=mapView&&searchMap&&!mapUnavailable?matching.filter(card=>visibleKeys.includes(card.key)):matching;
 const unmapped=matching.filter(card=>!hasCoordinates(card)).length;
 function selectCard(key:string){setFocusSequence(value=>value+1);selectSite(key);}
 function selectSite(key:string){setUrlFilters(previous=>({...previous,selected:key}));setSheetExpanded(true);requestAnimationFrame(()=>{const card=document.getElementById('site-card-'+key),panel=resultsPanel.current;if(card&&panel){const isMobile=typeof window!=='undefined'&&window.innerWidth<=900;if(isMobile){card.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',inline:'center',block:'nearest'});}else{const rect=card.getBoundingClientRect(),parent=panel.getBoundingClientRect();panel.scrollTo?.({top:panel.scrollTop+rect.top-parent.top-12,behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}}});}
 useEffect(()=>{if(activeKey&&!matching.some(card=>card.key===activeKey))setUrlFilters(previous=>({...previous,selected:''}));},[matching,activeKey]);
 const developers=[...new Set(cards.map(c=>c.developer))].sort(),countries=[...new Set(cards.map(c=>c.country??'Unknown'))].sort();
 useEffect(()=>{if(!mapView||!activeKey)return;const element=document.getElementById('site-card-'+activeKey),panel=resultsPanel.current;if(element&&panel){const isMobile=typeof window!=='undefined'&&window.innerWidth<=900;if(isMobile){element.scrollIntoView({behavior:'auto',inline:'center',block:'nearest'});}else{const top=element.getBoundingClientRect().top-panel.getBoundingClientRect().top+panel.scrollTop;panel.scrollTo?.({top:Math.max(0,top-12),behavior:'auto'});}}},[activeKey,mapView,visible.map(c=>c.key).join(',')]);
 useEffect(()=>{if(!mapView)return;const panel=resultsPanel.current;if(!panel)return;const isMobile=typeof window!=='undefined'&&window.innerWidth<=900;if(!isMobile)return;const grid=panel.querySelector('.collection-grid');if(!grid)return;let timer:ReturnType<typeof setTimeout>;let userScrolled=false;const onPointerDown=()=>{userScrolled=true;};const onScroll=()=>{if(!userScrolled)return;clearTimeout(timer);timer=setTimeout(()=>{const gridRect=grid.getBoundingClientRect();const centerX=gridRect.left+gridRect.width/2;const cards=grid.querySelectorAll<HTMLElement>('.collection-card');let closestKey:string|null=null,minDist=Infinity;cards.forEach(card=>{const rect=card.getBoundingClientRect();const cardCenter=rect.left+rect.width/2;const dist=Math.abs(cardCenter-centerX);if(dist<minDist){minDist=dist;const key=card.id.replace('site-card-','');if(key)closestKey=key;}});userScrolled=false;if(closestKey&&minDist<gridRect.width*0.45){setUrlFilters(prev=>prev.selected===closestKey?prev:({...prev,selected:closestKey!}));}},120);};grid.addEventListener('pointerdown',onPointerDown,{passive:true});grid.addEventListener('scroll',onScroll,{passive:true});return()=>{clearTimeout(timer);grid.removeEventListener('pointerdown',onPointerDown);grid.removeEventListener('scroll',onScroll);};},[mapView,visible.map(c=>c.key).join(',')]);
 const imageLayout=`${view}:${visible.map(c=>c.key).join(",")}`;
 return <section aria-label="Filter locations">
 <div className="site-filter-panel location-filter-panel">
 <DirectoryFilters className="filters site-filters location-primary-filters" label="Location filters">
  <label>Builder<select value={filters.developer} onChange={e=>change('developer',e.target.value)}><option value="">All builders</option>{developers.map(d=><option key={d}>{d}</option>)}</select></label>
  <label>Country<select value={filters.country} onChange={e=>change('country',e.target.value)}><option value="">All countries</option>{countries.map(c=><option key={c}>{c}</option>)}</select></label>
  <label>Minimum bedrooms<input type="number" min="1" step="1" value={filters.minBeds} onChange={e=>change('minBeds',e.target.value)} placeholder="Any"/></label>
  <label>Maximum price (£)<input type="number" min="0" step="1000" value={filters.maxPrice} onChange={e=>change('maxPrice',e.target.value)} placeholder="No maximum"/></label>
  <button className="location-filter-reset" type="button" disabled={busy} onClick={()=>{setUrlFilters(previous=>({...urlDefaults,view:previous.view,lat:previous.lat,lng:previous.lng,zoom:previous.zoom}));setPoint(null);setMessage('');}}>Reset filters</button>
 <details className="location-filter-disclosure">
  <summary>More filters <span>House style, price range and distance</span></summary>
  <div className="filters site-filters">
   <label>Minimum price (£)<input type="number" min="0" step="1000" value={filters.minPrice} onChange={e=>change('minPrice',e.target.value)} placeholder="No minimum"/></label>
   <label>Maximum bedrooms<input type="number" min="1" step="1" value={filters.maxBeds} onChange={e=>change('maxBeds',e.target.value)} placeholder="Any"/></label>
   <label>House style<select value={filters.style} onChange={e=>change('style',e.target.value)}><option value="">All styles</option>{['Attached / terraced','Semi-detached','Detached','Apartment','Unknown'].map(s=><option key={s}>{s}</option>)}</select></label>
  </div>
<div className="site-location-controls"><form onSubmit={locate}><label htmlFor="site-postcode">Distance from postcode</label><div className="site-postcode-input"><input id="site-postcode" value={postcode} onChange={e=>setPostcode(e.target.value)} autoComplete="postal-code" placeholder="e.g. SW1A 1AA" required maxLength={10}/><button disabled={busy}>Find location</button></div></form><button type="button" disabled={busy} onClick={useLocation}>Use my location</button><label>Within<select disabled={!point} value={filters.radius} onChange={e=>change('radius',e.target.value)}><option value="">Any distance</option>{[5,10,25,50,100,200].map(n=><option key={n} value={n}>{n} miles</option>)}</select></label><label>Order by<select value={order} onChange={e=>setOrder(e.target.value)}><option value="name">Location name A–Z</option><option value="distance" disabled={!point}>Nearest first</option></select></label></div><p role="status" className="subtle">{message||'Enter a postcode or use your location to filter by distance.'} Distances are straight-line miles.</p><p className="subtle">A location matches when an advertised home meets all selected property filters. Prices and availability reflect the latest collection update; unknown prices and bedrooms do not match numeric limits.</p>
 </details>
 </DirectoryFilters>
 {invalid&&<p role="alert" className="error">Minimum price and bedrooms must not exceed their maximum values.</p>}
 </div>
<div className="directory-toolbar location-explorer-toolbar">
 <div className="location-view-controls"><ViewOptions view={mapView?'map':view} onChange={changeView} ariaLabel="Locations layout"/><button type="button" className="location-map-toggle" aria-label="Map" aria-pressed={mapView} onClick={()=>{setMapUnavailable(false);setUrlFilters(previous=>({...previous,view:'map'}));}}>▧ <span>Map</span></button></div>
 <p className="count" aria-live="polite">{visible.length} {visible.length===1?'development':'developments'}{mapView&&searchMap?' in this area':''}</p>
 {mapView&&<label className="site-map-search"><input type="checkbox" checked={searchMap} onChange={e=>setSearchMap(e.target.checked)}/> Search as I move</label>}
 </div>
 <div ref={explorerPanel} className={mapView?'site-map-directory location-explorer'+(sheetExpanded?' sheet-expanded':''):'location-directory'}>
 {mapView&&<Suspense fallback={<aside className="site-map-panel"><p className="empty">Loading map…</p></aside>}><SiteMap cards={matching} activeKey={activeKey} focusSequence={focusSequence} hoverKey={hoverKey} camera={camera} onCameraChange={updateCamera} onBoundsChange={()=>setMapUnavailable(false)} onVisibleSitesChange={setVisibleKeys} onSelect={selectSite} onUnavailable={()=>setMapUnavailable(true)} focusArea={focusArea}/></Suspense>}
 <div className="site-preview-panel" ref={resultsPanel}>
 {mapView&&<button className="site-sheet-handle" type="button" aria-expanded={sheetExpanded} aria-label={sheetExpanded?'Collapse development previews':'Expand development previews'} onClick={()=>setSheetExpanded(value=>!value)} onTouchStart={e=>{sheetStart.current=e.touches[0]?.clientY??null;}} onTouchEnd={e=>{const y=e.changedTouches[0]?.clientY;if(sheetStart.current!==null&&y!==undefined&&Math.abs(y-sheetStart.current)>20)setSheetExpanded(y<sheetStart.current);sheetStart.current=null;}}><span/><b>{visible.length} developments · {sheetExpanded?'Show map':'View previews'}</b></button>}
 <div className={`collection-grid directory-${mapView?'compact':view}`}>
 {visible.map(card=>{
 const href=withFilters(card.href??`${basePath}/${card.key}`,{...Object.fromEntries(Object.keys(defaults).map(key=>[key,urlFilters[key as keyof typeof urlFilters]])),postcode,order:order==='name'?'':order});
 const content=<><div className="site-preview-photo"><ScrollCollectionImage images={card.images} image={card.image} description={card.description} layout={imageLayout} caption={mapView}/></div><div className="card-body"><h2>{card.name}</h2><p className="site-builder-line">{builderLogo(card.developer)&&<img className="site-builder-logo" style={{background:['Bloor Homes','Cala','Barratt','David Wilson Homes','Robertson Homes','Lynch Homes'].includes(card.developer)?'#193963':undefined}} src={builderLogo(card.developer)} alt="" loading="lazy"/>}<BuilderName name={card.developer}/></p><p className="subtle">{card.country??'Country unavailable'}{point&&` · ${card.miles===null?'Distance unavailable':card.miles.toFixed(1)+' miles'}`}</p><dl className={`site-property-summary${mapView?' site-compact-facts':''}`}><div><dt>Prices</dt><dd>{range(card.properties.map(p=>p.price),money)}</dd></div><div><dt>Bedrooms</dt><dd>{range(card.properties.map(p=>p.bedrooms),String)}</dd></div><div className="site-style-fact"><dt>Styles</dt><dd>{[...new Set(card.properties.map(p=>p.style??'Unknown'))].join(' · ')||'Not available'}</dd></div></dl><p className="subtle site-image-count">{card.count} {card.count===1?'image':'images'}{card.propertyScope==='Published homes'?' · Published homes only':''}</p>{mapView?<Link className="site-explore-link" href={href} onClick={e=>e.stopPropagation()}>Explore development →</Link>:<span className="subtle">Explore collection →</span>}</div></>;
 const className=`collection-card${activeKey===card.key?' is-map-active':''}${hoverKey===card.key?' is-map-hovered':''}`;
 return mapView?<article id={'site-card-'+card.key} key={card.key} className={className} onMouseEnter={()=>setHoverKey(card.key)} onMouseLeave={()=>setHoverKey(null)}><button className="site-card-select" aria-label={`Select ${card.name} on map`} aria-pressed={activeKey===card.key} onClick={()=>selectCard(card.key)} onFocus={()=>setHoverKey(card.key)} onBlur={()=>setHoverKey(null)}/>{content}</article>:<Link id={'site-card-'+card.key} key={card.key} className={className} href={href}>{content}</Link>;
 })}
 </div>
 {!visible.length&&<p className="empty">{mapView?'No developments in this area match your filters. Move the map or show all matching sites.':'No developments match your filters. Try widening your search.'}</p>}
 {mapView&&unmapped>0&&<p className="subtle site-unmapped">{unmapped} matching {unmapped===1?'development has':'developments have'} no map coordinates. Browse List or Cards to see them.</p>}
 </div></div></section>;
}
