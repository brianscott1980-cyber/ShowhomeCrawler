'use client';
import {useRef,useId} from 'react';
import Link from 'next/link';
import {useSavedLocation} from './location-preferences';
import {milesBetween} from './site-filters';
export interface BuildingDevelopment {key:string;name:string;href:string|null;town:string|null;latitude:number|null;longitude:number|null;price:string}
export function BuildingDevelopmentList({developments,buildingName}:{developments:BuildingDevelopment[];buildingName:string}){
 const dialog=useRef<HTMLDialogElement>(null),titleId=useId();
 const location=useSavedLocation();
 const items=developments.map(item=>({...item,distance:location&&item.latitude!==null&&item.longitude!==null&&Number.isFinite(item.latitude)&&Number.isFinite(item.longitude)?milesBetween(location,{latitude:item.latitude,longitude:item.longitude}):null}));
 if(location)items.sort((a,b)=>(a.distance??Infinity)-(b.distance??Infinity)||a.name.localeCompare(b.name));
 return <><button type="button" className="development-set-location" aria-haspopup="dialog" onClick={()=>dialog.current?.showModal()}>{items.length}</button><dialog ref={dialog} className="building-developments-dialog" aria-labelledby={titleId} onClick={event=>{if(event.target===event.currentTarget){const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.current?.close();}}}><div className="building-developments-dialog-heading"><h2 id={titleId}>{buildingName} Developments</h2><button type="button" aria-label="Close developments" onClick={()=>dialog.current?.close()}>×</button></div>{items.length?<ul>{items.map(item=><li key={item.key}><div>{item.href?<Link prefetch={false} href={item.href}>{item.name}</Link>:item.name}{item.town?` · ${item.town}`:''}{item.distance!==null?` · ${item.distance.toFixed(1)} miles`:''}</div><p>{item.price==='Not available'?'Price not available':item.price}</p></li>)}</ul>:<p>No developments available.</p>}</dialog></>;
}
