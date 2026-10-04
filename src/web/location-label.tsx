'use client';
import {useEffect,useState} from 'react';
import type {SavedLocation} from './location-preferences';
const areas=new Map<string,string>();
export function LocationLabel({location}:{location:SavedLocation}){
 const key=`${location.latitude}:${location.longitude}`;
 const [resolved,setResolved]=useState<{key:string;area:string}|null>(null);
 useEffect(()=>{
  let alive=true;
  if(areas.has(key)){setResolved({key,area:areas.get(key)!});return;}
  void fetch(`/api/location?latitude=${location.latitude}&longitude=${location.longitude}`).then(response=>response.ok?response.json():null).then(data=>{if(alive&&typeof data?.area==='string'&&data.area){areas.set(key,data.area);setResolved({key,area:data.area});}}).catch(()=>{});
  return()=>{alive=false;};
 },[key,location.area,location.latitude,location.longitude]);
 return <>{(resolved?.key===key?resolved.area:null)||location.area||'Your area'}</>;
}
