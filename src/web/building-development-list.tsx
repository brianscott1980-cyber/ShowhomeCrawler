'use client';
import {useRef,useId,useState,useMemo,useEffect,lazy,Suspense} from 'react';
import {OpeningHours} from './opening-hours';
import {useSavedLocation} from './location-preferences';
import {milesBetween,type SiteCard} from './site-filters';
import type {FocusArea} from './map-marker-visibility';
import {NextCardImage} from './card-image';
import {optimizedImageSource} from './optimized-image-source';
const SiteMap=lazy(()=>import('./site-map').then(module=>({default:module.SiteMap})));
export interface BuildingDevelopment {key:string;name:string;href:string|null;town:string|null;latitude:number|null;longitude:number|null;price:string;developer:string;image:string|null;logo:string|null;logoBackground:string;address?:string;telephone?:string|null;email?:string|null;openingHours?:string[]}
export function BuildingDevelopmentList({developments,buildingName}:{developments:BuildingDevelopment[];buildingName:string}){
 const dialog=useRef<HTMLDialogElement>(null),titleId=useId();
 const [open,setOpen]=useState(false),[active,setActive]=useState<string|null>(null),[sequence,setSequence]=useState(0),[unavailable,setUnavailable]=useState(false);
 const cardList=useRef<HTMLUListElement>(null),currentActive=useRef(active);currentActive.current=active;
 const cardRefs=useRef(new Map<string,HTMLLIElement>());
 const mapContainer=useRef<HTMLDivElement>(null);
 const [focusArea,setFocusArea]=useState<FocusArea>();
 useEffect(()=>{
  if(!open||!mapContainer.current)return;
  const element=mapContainer.current,list=cardList.current;
  const measure=()=>{const width=element.clientWidth,height=element.clientHeight,mapBounds=element.getBoundingClientRect(),cardsBounds=list?.getBoundingClientRect();const mobile=width<=700;
   setFocusArea({left:mobile?16:cardsBounds?cardsBounds.right-mapBounds.left:width*.3+16,top:16,right:mobile?width-16:width,bottom:mobile&&cardsBounds?cardsBounds.top-mapBounds.top-16:height-16});
  };
  measure();const observer=new ResizeObserver(measure);observer.observe(element);if(list)observer.observe(list);return()=>observer.disconnect();
 },[open]);
 const location=useSavedLocation();
 useEffect(()=>{
  const list=cardList.current;if(!open||!list)return;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const update=()=>{const bounds=list.getBoundingClientRect();if(bounds.width<=0||!window.matchMedia('(max-width: 700px)').matches)return;const centre=(bounds.left+bounds.right)/2;
   let nearest:string|null=null,distance=Infinity;for(const [key,card] of cardRefs.current){const box=card.getBoundingClientRect(),delta=Math.abs((box.left+box.right)/2-centre);if(delta<distance){nearest=key;distance=delta;}}
   if(nearest&&nearest!==currentActive.current){currentActive.current=nearest;setActive(nearest);setSequence(value=>value+1);}
  };
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(update,100);};
  list.addEventListener('scroll',schedule,{passive:true});const observer=new ResizeObserver(schedule);observer.observe(list);schedule();
  return()=>{clearTimeout(timer);list.removeEventListener('scroll',schedule);observer.disconnect();};
 },[open,developments,location]);

 const items=developments.map(item=>({...item,distance:location&&item.latitude!==null&&item.longitude!==null&&Number.isFinite(item.latitude)&&Number.isFinite(item.longitude)?milesBetween(location,{latitude:item.latitude,longitude:item.longitude}):null}));
 if(location)items.sort((a,b)=>(a.distance??Infinity)-(b.distance??Infinity)||a.name.localeCompare(b.name));
 const mapCards=useMemo(()=>developments.map(item=>({key:item.key,name:item.name,developer:item.developer,href:item.href??undefined,image:item.image??'',description:'',count:0,country:null,town:item.town,latitude:item.latitude??undefined,longitude:item.longitude??undefined,properties:[]} satisfies SiteCard)),[developments]);
 const select=(key:string,fromMap=false)=>{setActive(key);setSequence(value=>value+1);if(fromMap)cardRefs.current.get(key)?.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});};
 return <><button type="button" className="development-set-location building-developments-trigger" aria-label={`View ${items.length} developments on a map`} aria-haspopup="dialog" onClick={()=>{setOpen(true);dialog.current?.showModal();}}>{items.length}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/></svg></button><dialog ref={dialog} className="building-developments-dialog" aria-labelledby={titleId} onClose={()=>setOpen(false)} onClick={event=>{if(event.target===event.currentTarget){const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.current?.close();}}}><div className="building-developments-dialog-heading"><h2 id={titleId} className="sr-only">{buildingName} Developments</h2><button type="button" aria-label="Close developments" onClick={()=>dialog.current?.close()}>×</button></div><div className="building-developments-dialog-body"><ul ref={cardList} className="building-developments-cards" aria-label="Developments">{items.map(item=><li ref={element=>{if(element)cardRefs.current.set(item.key,element);else cardRefs.current.delete(item.key);}} key={item.key} className={`collection-card building-development-card${active===item.key?' is-selected':''}`}><button type="button" className="building-development-select" aria-pressed={active===item.key} aria-label={`Highlight ${item.name} on map`} onClick={()=>select(item.key)}><h3>{item.name}</h3>{item.image?<div className="site-preview-photo"> <NextCardImage src={optimizedImageSource(item.image)} alt={item.name} width={400} height={300} sizes="(max-width: 700px) 80vw, 140px" loading="lazy"/></div>:item.logo?<div className="building-development-logo-fallback" style={{background:item.logoBackground}}><img src={item.logo} alt={`${item.developer} logo`}/></div>:<div className="builder-navigation-placeholder">{item.developer}</div>}<div className="card-body"><dl className="building-development-facts"><div className="building-development-price"><dt>Prices From:</dt><dd>{item.price==='Not available'?'Not available':item.price.split(' – ')[0]}</dd></div><div className="building-development-distance"><dt>Distance:</dt><dd>{item.distance!==null?`${item.distance.toFixed(1)} miles`:'Not available'}</dd></div></dl></div></button>{item.logo&&<img className="development-builder-logo building-development-card-logo" src={item.logo} alt={`${item.developer} logo`} style={{background:item.logoBackground}} loading="lazy"/>}<dl className="building-development-contact building-development-facts"><div><dt>Telephone:</dt><dd>{item.telephone?<a href={`tel:${item.telephone.replace(/[^+\d]/g,'')}`}>{item.telephone}</a>:'Not available'}</dd></div><div><dt>Opening:</dt><dd>{item.openingHours?.length?<OpeningHours hours={item.openingHours}/>:'Not available'}</dd></div></dl></li>)}</ul><div ref={mapContainer} className="building-developments-map">{open&&<Suspense fallback={<p role="status">Loading development map…</p>}><SiteMap fitZoomOut={1} focusArea={focusArea} cards={mapCards} simpleAttribution activeKey={active} focusSequence={sequence} onBoundsChange={()=>{}} onSelect={key=>select(key,true)} onUnavailable={()=>setUnavailable(true)}/></Suspense>}{unavailable&&<p role="status">Map unavailable. You can still browse the development cards.</p>}</div></div></dialog></>;
}
