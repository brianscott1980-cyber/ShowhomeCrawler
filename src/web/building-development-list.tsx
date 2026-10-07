'use client';
import Link from 'next/link';
import {useSavedLocation} from './location-preferences';
import {milesBetween} from './site-filters';
export interface BuildingDevelopment {key:string;name:string;href:string|null;town:string|null;latitude:number|null;longitude:number|null}
export function BuildingDevelopmentList({developments}:{developments:BuildingDevelopment[]}){
 const location=useSavedLocation();
 const items=developments.map(item=>({...item,distance:location&&item.latitude!==null&&item.longitude!==null&&Number.isFinite(item.latitude)&&Number.isFinite(item.longitude)?milesBetween(location,{latitude:item.latitude,longitude:item.longitude}):null}));
 if(location)items.sort((a,b)=>(a.distance??Infinity)-(b.distance??Infinity)||a.name.localeCompare(b.name));
 return <>{items.map(item=><span className="development-style" key={item.key}>{item.href?<Link prefetch={false} href={item.href}>{item.name}</Link>:item.name}{item.town?` · ${item.town}`:''}{item.distance!==null?` · ${item.distance.toFixed(1)} miles`:''}</span>)}</>;
}
