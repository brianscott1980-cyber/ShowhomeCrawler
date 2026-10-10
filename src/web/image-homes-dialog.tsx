'use client';
import {useEffect,useId,useRef,useState,type CSSProperties} from 'react';
import type {GalleryImage,DevelopmentPreview} from './gallery-page-data';
import {milesBetween,type LocationPoint} from './site-filters';
import {developmentName} from './development-name';
import Link from 'next/link';
import {CardImage} from './card-image';
import {routeSlug} from './group-routes';
import {homeTypeName,isPlotName} from '../reports/home-display';
export function imageHomes(homes:GalleryImage['homes'],point:LocationPoint|null){
 const unique=new Map<string,GalleryImage['homes'][number]>();
 for(const home of homes){const key=JSON.stringify([home.builderSlug,home.developmentUrl,homeTypeName(home.buildingName??home.name).toLowerCase()]);if(!unique.has(key))unique.set(key,home);}
 return [...unique.values()].map(home=>({...home,miles:point&&Number.isFinite(home.latitude)&&Number.isFinite(home.longitude)?milesBetween(point,{latitude:home.latitude!,longitude:home.longitude!}):null})).sort((a,b)=>(a.miles??Infinity)-(b.miles??Infinity)||developmentName(a.development).localeCompare(developmentName(b.development))||a.name.localeCompare(b.name));
}
function HomeActionIcon({globe=false}:{globe?:boolean}){
 return <span className="image-homes-trigger-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{globe?<><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>:<path d="M3 10 12 3 21 10M5 9v11h14V9M9 20v-7h6v7"/>}</svg></span>;
}
export function ImageHomesDialog({image,location=null,developments}:{image:GalleryImage;location?:LocationPoint|null;developments?:DevelopmentPreview[]}){
 const [open,setOpen]=useState(false),dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),title=useId();
 useEffect(()=>{if(open)dialog.current?.showModal();},[open]);
 const homes=imageHomes(image.homes,location);
 const buildings=new Map<string,{href:string;name:string;image:string;homes:typeof homes}>();
 for(const home of homes){const name=homeTypeName(home.buildingName??home.name);if(!home.buildingHref&&isPlotName(name))continue;const href=home.buildingHref??`/buildings/${home.builderSlug??image.slug}/${routeSlug(name)}`;const existing=buildings.get(href);if(existing)existing.homes.push(home);else buildings.set(href,{href,name,image:home.buildingImage??`/api/assets/${image.slug}/${image.path.split('/').map(encodeURIComponent).join('/')}`,homes:[home]});}
 const developmentMode=developments!==undefined;
 const cards=developmentMode?developments.map(development=>({...development,homes:[{builderName:development.builderName,builderLogo:development.builderLogo,builderLogoBackground:development.builderLogoBackground,miles:location&&Number.isFinite(development.latitude)&&Number.isFinite(development.longitude)?milesBetween(location,{latitude:development.latitude!,longitude:development.longitude!}):null}]})).sort((a,b)=>(a.homes[0]!.miles??Infinity)-(b.homes[0]!.miles??Infinity)||a.name.localeCompare(b.name)):[...buildings.values()];
 const action=developmentMode?'Explore developments':'Explore these homes';
 if(!cards.length)return null;
 if(!developmentMode&&cards.length===1)return <div className="image-home-details"><Link className="image-homes-trigger" prefetch={false} href={cards[0]!.href}><span>Explore this home</span><HomeActionIcon/></Link></div>;
 return <div className="image-home-details" onClick={event=>event.stopPropagation()}>
  <button type="button" className="image-homes-trigger" ref={trigger} aria-haspopup="dialog" onClick={()=>setOpen(true)}><span>{action}</span><HomeActionIcon globe={developmentMode}/></button>
  {open&&<dialog ref={dialog} className={`image-tags-dialog image-homes-dialog${developmentMode?' image-developments-dialog':''}`} style={{'--home-columns':Math.min(4,cards.length)} as CSSProperties} aria-labelledby={title} onClose={()=>{setOpen(false);trigger.current?.focus();}} onClick={event=>{if(event.target===event.currentTarget){const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.current?.close();}}}>
   <div className="image-tags-dialog-heading"><div><h2 id={title}>{action}</h2><p className="image-homes-intro">{developmentMode?'Discover the developments where this home is available.':'Choose a home to discover its interiors.'}</p></div><button type="button" aria-label={developmentMode?'Close developments':'Close home associations'} onClick={()=>dialog.current?.close()}>×</button></div>
   <div className="image-homes-preview-grid">{cards.map(card=><Link prefetch={false} className="collection-card image-home-preview" href={card.href} key={card.href}>
    <div className="image-home-preview-photo"><CardImage src={card.image} alt={card.name} loading="lazy"/>
    {card.homes[0]?.builderLogo&&<img className="image-home-builder-logo" src={card.homes[0].builderLogo} alt={`${card.homes[0].builderName??image.developer} logo`} style={{background:card.homes[0].builderLogoBackground??'#fff'}} loading="lazy"/>}</div>
    <div className="card-body"><p className="eyebrow image-home-builder-name">{card.homes[0]?.builderName??image.developer}</p><h3>{card.name}</h3>
    {!developmentMode&&<div className="image-home-bedrooms">{[...new Set(card.homes.map(home=>'bedrooms' in home?Number(home.bedrooms):0).filter(beds=>Number.isInteger(beds)&&beds>0))].sort((a,b)=>a-b).map(beds=><span key={beds} role="img" aria-label={`${beds} bedrooms`} title={`${beds} bedrooms`}>{Array.from({length:beds},(_,index)=><svg key={index} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 18V6M21 18v-7a2 2 0 0 0-2-2h-7v7M3 16h18M3 11h9"/><rect x="5" y="8" width="5" height="3" rx="1"/></svg>)}</span>)}</div>}
    {card.homes[0]?.miles!=null&&<p className="image-home-distance">{card.homes[0].miles.toFixed(1)} miles away</p>}
    <span className="image-home-preview-action">{developmentMode?'Explore development':'Explore home'} <span aria-hidden="true">→</span></span>
    </div>
   </Link>)}</div>
  </dialog>}
 </div>;
}
