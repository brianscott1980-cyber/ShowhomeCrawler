'use client';

import {useEffect, useRef, useState} from 'react';
import type {Map as MapInstance, Marker, GeoJSONSource} from 'maplibre-gl';
import type {SiteCard} from './site-filters';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface MapBounds {west:number; east:number; south:number; north:number}
export interface MapCamera {lng:number;lat:number;zoom:number}
export function hasCoordinates(card:SiteCard):card is SiteCard & {latitude:number;longitude:number} {
 return Number.isFinite(card.latitude) && Number.isFinite(card.longitude) && Math.abs(card.latitude!)<=90 && Math.abs(card.longitude!)<=180;
}
export function inMapBounds(card:SiteCard, bounds:MapBounds) {
 if(!hasCoordinates(card))return false;
 const longitude=((card.longitude-bounds.west)%360+360)%360+bounds.west;
 return card.latitude>=bounds.south && card.latitude<=bounds.north && longitude<=bounds.east;
}
function siteFeatures(cards:SiteCard[]) {
 return {type:'FeatureCollection' as const,features:cards.filter(hasCoordinates).map(card=>({type:'Feature' as const,geometry:{type:'Point' as const,coordinates:[card.longitude,card.latitude]},properties:{key:card.key,name:card.name}}))};
}
const reducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export function SiteMap({cards,activeKey,hoverKey,onBoundsChange,onSelect,onUnavailable,camera,onCameraChange}:{cards:SiteCard[];activeKey:string|null;hoverKey?:string|null;onBoundsChange:(bounds:MapBounds)=>void;onSelect:(key:string)=>void;onUnavailable:()=>void;camera?:MapCamera;onCameraChange?:(camera:MapCamera)=>void}) {
 const container=useRef<HTMLDivElement>(null), map=useRef<MapInstance|null>(null), highlight=useRef<Marker|null>(null);
 const latest=useRef({cards,activeKey,hoverKey,onBoundsChange,onSelect,onUnavailable,camera,onCameraChange});
 latest.current={cards,activeKey,hoverKey,onBoundsChange,onSelect,onUnavailable,camera,onCameraChange};
 const selectionSeen=useRef(activeKey);
 const publishedCamera=useRef<MapCamera|null>(null);
 const clusterRequest=useRef(0);
 const [ready,setReady]=useState(false),[status,setStatus]=useState('Loading map…'),[choices,setChoices]=useState<SiteCard[]>([]);
 useEffect(()=>{
  let disposed=false,resize:ResizeObserver|undefined;
  import('maplibre-gl').then(({Map,NavigationControl,LngLatBounds,Marker,setWorkerUrl})=>{
   if(disposed||!container.current)return;
   setWorkerUrl('/maps/worker/maplibre-gl-worker.mjs');
   const saved=latest.current.camera;
   const instance=new Map({container:container.current,style:'/maps/showhome.json',center:saved?[saved.lng,saved.lat]:[-3,55],zoom:saved?.zoom??4.5,dragRotate:false,touchPitch:false,maxPitch:0});
   map.current=instance;
   instance.addControl(new NavigationControl({showCompass:false}),'top-right');
   const publish=()=>{
    if(disposed)return;
    const b=instance.getBounds(),c=instance.getCenter();
    latest.current.onBoundsChange({west:b.getWest(),east:b.getEast(),south:b.getSouth(),north:b.getNorth()});
    const position={lng:c.lng,lat:c.lat,zoom:instance.getZoom()};
    publishedCamera.current=position;latest.current.onCameraChange?.(position);
   };
   instance.on('moveend',publish);
   instance.on('load',()=>{
    if(disposed)return;
    instance.addSource('sites',{type:'geojson',data:siteFeatures(latest.current.cards),cluster:true,clusterRadius:38,clusterMaxZoom:13});
    instance.addLayer({id:'site-clusters',type:'circle',source:'sites',filter:['has','point_count'],paint:{'circle-color':'#193963','circle-radius':['step',['get','point_count'],17,20,21,100,25],'circle-stroke-width':2,'circle-stroke-color':'#ffffff'}});
    instance.addLayer({id:'site-cluster-count',type:'symbol',source:'sites',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-font':['Noto Sans Regular'],'text-size':12},paint:{'text-color':'#ffffff'}});
    instance.addLayer({id:'site-dots',type:'circle',source:'sites',filter:['!',['has','point_count']],paint:{'circle-color':'#193963','circle-radius':7,'circle-stroke-width':2,'circle-stroke-color':'#ffffff'}});
    instance.on('click','site-clusters',async e=>{
     const feature=e.features?.[0];if(!feature||feature.geometry.type!=='Point')return;
     const request=++clusterRequest.current;
     setChoices([]);
     try {
      const zoom=await (instance.getSource('sites') as GeoJSONSource).getClusterExpansionZoom(Number(feature.properties?.cluster_id));
      if(disposed||request!==clusterRequest.current)return;
      instance.stop();
      instance.jumpTo({center:feature.geometry.coordinates as [number,number],zoom:Math.min(instance.getMaxZoom(),Math.max(zoom,instance.getZoom()+1))});
      publish();
     } catch { /* A cluster can disappear when filters change while its zoom is resolved. */ }
    });
    instance.on('click','site-dots',e=>{
     const feature=e.features?.[0];if(!feature||feature.geometry.type!=='Point')return;
     const [lng,lat]=feature.geometry.coordinates;
     const coincident=latest.current.cards.filter(c=>hasCoordinates(c)&&Math.abs(c.longitude-lng!)<0.00001&&Math.abs(c.latitude-lat!)<0.00001);
     if(coincident.length>1)setChoices(coincident);else if(feature.properties?.key)latest.current.onSelect(String(feature.properties.key));
    });
    for(const layer of ['site-clusters','site-dots']){
     instance.on('mouseenter',layer,()=>{instance.getCanvas().style.cursor='pointer';});
     instance.on('mouseleave',layer,()=>{instance.getCanvas().style.cursor='';});
    }
    const button=document.createElement('button');button.type='button';button.className='site-map-marker is-active';button.setAttribute('aria-label','Selected development');
    button.addEventListener('click',()=>{const key=latest.current.hoverKey||latest.current.activeKey;if(key)latest.current.onSelect(key);});
    highlight.current=new Marker({element:button});
    setReady(true);setStatus('');publish();
   });
   instance.on('error',()=>{if(!disposed&&!instance.isStyleLoaded()){setStatus('Map unavailable. Switch to List or Cards to browse every development.');latest.current.onUnavailable();}});
   const mapped=latest.current.cards.filter(hasCoordinates);
   if(!saved&&mapped.length)instance.fitBounds(mapped.reduce((b,c)=>b.extend([c.longitude,c.latitude]),new LngLatBounds([mapped[0]!.longitude,mapped[0]!.latitude],[mapped[0]!.longitude,mapped[0]!.latitude])),{padding:55,maxZoom:12,duration:0});
   resize=new ResizeObserver(()=>instance.resize());resize.observe(container.current);
  }).catch(()=>{if(!disposed){setStatus('Map unavailable. Switch to List or Cards to browse every development.');latest.current.onUnavailable();}});
  return()=>{disposed=true;resize?.disconnect();highlight.current?.remove();highlight.current=null;map.current?.remove();map.current=null;};
 },[]);
 useEffect(()=>{
  if(!ready||!map.current)return;
  (map.current.getSource('sites') as GeoJSONSource)?.setData(siteFeatures(cards));setChoices([]);
 },[cards,ready]);
 useEffect(()=>{
  const instance=map.current,marker=highlight.current;if(!ready||!instance||!marker)return;
  const card=cards.find(c=>c.key===(hoverKey||activeKey));
  if(card&&hasCoordinates(card)){marker.setLngLat([card.longitude,card.latitude]).addTo(instance);marker.getElement().setAttribute('aria-label',`Select ${card.name}, ${card.developer}`);}else marker.remove();
 },[activeKey,hoverKey,cards,ready]);
 useEffect(()=>{
  const instance=map.current,card=cards.find(c=>c.key===activeKey);
  if(!ready||!instance)return;
  if(selectionSeen.current===activeKey)return;
  selectionSeen.current=activeKey;
  if(!card||!hasCoordinates(card))return;
  if(!instance.getBounds().contains([card.longitude,card.latitude]))instance.easeTo({center:[card.longitude,card.latitude],duration:reducedMotion()?0:450});
 },[activeKey,ready,cards]);
 useEffect(()=>{
  const instance=map.current;if(!ready||!instance||!camera)return;
  const published=publishedCamera.current;
  // Camera values echoed through the URL must never undo an in-progress map interaction.
  if(published&&Math.abs(published.lng-camera.lng)<.00002&&Math.abs(published.lat-camera.lat)<.00002&&Math.abs(published.zoom-camera.zoom)<.01)return;
  const center=instance.getCenter();
  if(Math.abs(center.lng-camera.lng)>.001||Math.abs(center.lat-camera.lat)>.001||Math.abs(instance.getZoom()-camera.zoom)>.02)instance.jumpTo({center:[camera.lng,camera.lat],zoom:camera.zoom});
 },[camera?.lng,camera?.lat,camera?.zoom,ready]);
 function fitAll(){const mapped=cards.filter(hasCoordinates);if(!map.current||!mapped.length)return;map.current.fitBounds([[Math.min(...mapped.map(c=>c.longitude)),Math.min(...mapped.map(c=>c.latitude))],[Math.max(...mapped.map(c=>c.longitude)),Math.max(...mapped.map(c=>c.latitude))]],{padding:55,maxZoom:12,duration:reducedMotion()?0:450});}
 return <aside className="site-map-panel" aria-label="Explore development locations"><div className="site-map" ref={container}/><button type="button" className="site-map-fit" onClick={fitAll} disabled={!ready}>Show all matching sites</button>{status&&<p className="site-map-status" role="status">{status}</p>}{choices.length>0&&<div className="site-map-choices" aria-label="Developments at this location"><button className="site-map-close" onClick={()=>setChoices([])} aria-label="Close location choices">×</button><p>Developments at this location</p>{choices.map(c=><button key={c.key} onClick={()=>{latest.current.onSelect(c.key);setChoices([]);}}>{c.name}<span>{c.developer}</span></button>)}</div>}</aside>;
}
