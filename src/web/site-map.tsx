'use client';
import {focusPadding} from './map-focus';

import {useEffect, useId, useRef, useState} from 'react';
import type {Map as MapInstance, Marker, GeoJSONSource} from 'maplibre-gl';
import {siteExpansionZoom} from './site-cluster-focus';
import {fullyVisibleSiteKeys,type FocusArea} from './map-marker-visibility';
import {builderMapBrand} from './builder-map-brand';
import type {SiteCard} from './site-filters';
import 'maplibre-gl/dist/maplibre-gl.css';

import {hasCoordinates,type MapBounds,type MapCamera} from './map-coordinates';
export {hasCoordinates,inMapBounds,type MapBounds,type MapCamera} from './map-coordinates';
function siteFeatures(cards:SiteCard[]) {
 return {type:'FeatureCollection' as const,features:cards.filter(hasCoordinates).map(card=>({type:'Feature' as const,geometry:{type:'Point' as const,coordinates:[card.longitude,card.latitude]},properties:{key:card.key,name:card.name,builderColour:builderMapBrand(card.developer).primary,builderInitial:builderMapBrand(card.developer).initial}}))};
}
const reducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function fitMapBounds(instance:MapInstance,bounds:Parameters<MapInstance['fitBounds']>[0],options:NonNullable<Parameters<MapInstance['fitBounds']>[1]>,zoomOut:number){
 const fitted=zoomOut>0?instance.cameraForBounds(bounds,options):undefined;
 instance.fitBounds(bounds,{...options,...(fitted?.zoom!==undefined?{maxZoom:Math.max(instance.getMinZoom(),fitted.zoom-zoomOut)}:{})});
}
export function SiteMap({cards,clusterColor='#193963',simpleAttribution=false,autoFit=false,fitZoomOut=0,activeKey,focusSequence=0,hoverKey,onBoundsChange,onVisibleSitesChange,onSelect,onUnavailable,camera,onCameraChange,focusArea}:{cards:SiteCard[];clusterColor?:string;simpleAttribution?:boolean;autoFit?:boolean;fitZoomOut?:number;activeKey:string|null;focusSequence?:number;hoverKey?:string|null;onBoundsChange:(bounds:MapBounds)=>void;onVisibleSitesChange?:(keys:string[])=>void;onSelect:(key:string)=>void;onUnavailable:()=>void;camera?:MapCamera;onCameraChange?:(camera:MapCamera)=>void;focusArea?:FocusArea}) {
 const container=useRef<HTMLDivElement>(null), map=useRef<MapInstance|null>(null), highlight=useRef<Marker|null>(null);
 const latest=useRef({cards,activeKey,hoverKey,onBoundsChange,onVisibleSitesChange,onSelect,onUnavailable,camera,onCameraChange,focusArea,fitZoomOut});
 latest.current={cards,activeKey,hoverKey,onBoundsChange,onVisibleSitesChange,onSelect,onUnavailable,camera,onCameraChange,focusArea,fitZoomOut};
 const selectionSeen=useRef({key:activeKey,sequence:focusSequence});
 const publishedCamera=useRef<MapCamera|null>(null);
 const clusterRequest=useRef(0);
 const [ready,setReady]=useState(false),[status,setStatus]=useState('Loading map…'),[choices,setChoices]=useState<SiteCard[]>([]);
 const attributionId=useId(),attributionTouched=useRef(false);
 const [attributionOpen,setAttributionOpen]=useState(true);
 useEffect(()=>{
  if(!simpleAttribution||!ready)return;
  const timer=window.setTimeout(()=>{if(!attributionTouched.current)setAttributionOpen(false);},5000);
  return()=>window.clearTimeout(timer);
 },[simpleAttribution,ready]);
 useEffect(()=>{
  let disposed=false,resize:ResizeObserver|undefined;
  import('maplibre-gl').then(({Map,NavigationControl,LngLatBounds,Marker,setWorkerUrl})=>{
   if(disposed||!container.current)return;
   setWorkerUrl('/maps/worker/maplibre-gl-worker.mjs');
   const saved=latest.current.camera;
   const instance=new Map({container:container.current,style:'/maps/showhome.json',attributionControl:simpleAttribution?false:undefined,center:saved?[saved.lng,saved.lat]:[-3,55],zoom:saved?.zoom??4.5,dragRotate:false,touchPitch:false,maxPitch:0});
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
    instance.addLayer({id:'site-clusters',type:'circle',source:'sites',filter:['has','point_count'],paint:{'circle-color':clusterColor,'circle-radius':['step',['get','point_count'],17,20,21,100,25],'circle-stroke-width':2,'circle-stroke-color':'#ffffff'}});
    instance.addLayer({id:'site-cluster-count',type:'symbol',source:'sites',filter:['has','point_count'],layout:{'text-field':['to-string',['get','point_count']],'text-font':['Noto Sans Regular'],'text-size':12,'text-allow-overlap':true,'text-ignore-placement':true},paint:{'text-color':'#ffffff'}});
    instance.addLayer({id:'site-builder-badges',type:'circle',source:'sites',filter:['!',['has','point_count']],paint:{'circle-color':['get','builderColour'],'circle-radius':14,'circle-stroke-width':2,'circle-stroke-color':'#ffffff'}});
    instance.addLayer({id:'site-builder-icons',type:'symbol',source:'sites',filter:['!',['has','point_count']],layout:{'text-field':['get','builderInitial'],'text-font':['Noto Sans Regular'],'text-size':16,'text-allow-overlap':true,'text-ignore-placement':true},paint:{'text-color':'#ffffff'}});
    instance.on('click','site-clusters',async e=>{
     const feature=e.features?.[0];if(!feature||feature.geometry.type!=='Point')return;
     const request=++clusterRequest.current;
     setChoices([]);
     try {
      const zoom=await (instance.getSource('sites') as GeoJSONSource).getClusterExpansionZoom(Number(feature.properties?.cluster_id));
      if(disposed||request!==clusterRequest.current)return;
      instance.stop();
      instance.easeTo({duration:0,center:feature.geometry.coordinates as [number,number],zoom:Math.min(instance.getMaxZoom(),Math.max(zoom,instance.getZoom()+1))});
      publish();
     } catch { /* A cluster can disappear when filters change while its zoom is resolved. */ }
    });
    instance.on('click',['site-builder-badges','site-builder-icons'],e=>{
     const feature=e.features?.[0];if(!feature||feature.geometry.type!=='Point')return;
     const [lng,lat]=feature.geometry.coordinates;
     const coincident=latest.current.cards.filter(c=>hasCoordinates(c)&&Math.abs(c.longitude-lng!)<0.00001&&Math.abs(c.latitude-lat!)<0.00001);
     if(coincident.length>1)setChoices(coincident);else if(feature.properties?.key)latest.current.onSelect(String(feature.properties.key));
    });
    for(const layer of ['site-clusters','site-builder-badges','site-builder-icons']){
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
   if(!saved&&mapped.length)fitMapBounds(instance,mapped.reduce((b,c)=>b.extend([c.longitude,c.latitude]),new LngLatBounds([mapped[0]!.longitude,mapped[0]!.latitude],[mapped[0]!.longitude,mapped[0]!.latitude])),{padding:latest.current.focusArea?{left:latest.current.focusArea.left+24,top:latest.current.focusArea.top+24,right:Math.max(24,instance.getCanvas().clientWidth-latest.current.focusArea.right+24),bottom:Math.max(24,instance.getCanvas().clientHeight-latest.current.focusArea.bottom+24)}:55,maxZoom:12,duration:0},latest.current.fitZoomOut);
   resize=new ResizeObserver(()=>instance.resize());resize.observe(container.current);
  }).catch(()=>{if(!disposed){setStatus('Map unavailable. Switch to List or Cards to browse every development.');latest.current.onUnavailable();}});
  return()=>{disposed=true;resize?.disconnect();highlight.current?.remove();highlight.current=null;map.current?.remove();map.current=null;};
 },[]);
 useEffect(()=>{
  if(!ready||!map.current)return;
  (map.current.getSource('sites') as GeoJSONSource)?.setData(siteFeatures(cards));setChoices([]);
 },[cards,ready]);
 useEffect(()=>{
  const instance=map.current;if(!ready||!instance)return;
  let disposed=false,request=0,lastKeys:string|undefined;
  const invalidate=()=>{request++;};
  const update=async()=>{
   if(!latest.current.onVisibleSitesChange)return;
   const current=++request;
   const canvas=instance.getCanvas(),center=instance.getCenter();
   try {
    const keys=await fullyVisibleSiteKeys(instance.queryRenderedFeatures({layers:['site-clusters','site-builder-badges']}),([lng,lat])=>instance.project([lng+360*Math.round((center.lng-lng)/360),lat]),{width:canvas.clientWidth,height:canvas.clientHeight},instance.getZoom(),(id,count)=>(instance.getSource('sites') as GeoJSONSource).getClusterLeaves(id,count,0),latest.current.focusArea);
    if(disposed||current!==request)return;
    const signature=keys.join('\n');
    if(signature!==lastKeys){lastKeys=signature;latest.current.onVisibleSitesChange?.(keys);}
   } catch { /* Retry on idle after a source or camera change invalidates cluster IDs. */ }
  };
  instance.on('movestart',invalidate);instance.on('idle',update);
  void update();
  return()=>{disposed=true;request++;instance.off('movestart',invalidate);instance.off('idle',update);};
 },[cards,ready,focusArea]);
 useEffect(()=>{
  const instance=map.current,marker=highlight.current;if(!ready||!instance||!marker)return;
  let disposed=false,request=0,paintedCluster:number|null|undefined;
  const paintCluster=(id:number|null)=>{
   if(map.current!==instance||paintedCluster===id)return;
   paintedCluster=id;
   instance.setPaintProperty('site-clusters','circle-color',id===null?clusterColor:['case',['==',['get','cluster_id'],id],'#b89256',clusterColor]);
   instance.setPaintProperty('site-clusters','circle-stroke-width',id===null?2:['case',['==',['get','cluster_id'],id],4,2]);
  };
  const update=async()=>{
   const current=++request;
   const card=cards.find(c=>c.key===(hoverKey||activeKey));
   marker.remove();
   if(!card||!hasCoordinates(card)){paintCluster(null);return;}
   const source=instance.getSource('sites') as GeoJSONSource;
   const clusters=instance.queryRenderedFeatures({layers:['site-clusters']});
   const unique=new Map(clusters.map(feature=>[Number(feature.properties.cluster_id),feature]));
   try {
    const memberships=await Promise.all([...unique].map(async([id,feature])=>{
     const leaves=await source.getClusterLeaves(id,Number(feature.properties.point_count),0);
     return leaves.some(leaf=>leaf.properties?.key===card.key)?id:null;
    }));
    if(disposed||current!==request)return;
    const cluster=memberships.find(id=>id!==null)??null;
    paintCluster(cluster);
    if(cluster===null){
     const brand=builderMapBrand(card.developer),element=marker.getElement();
     element.style.background=brand.primary;
     element.style.width=element.style.height='36px';
     element.style.fontSize='16px';element.style.fontWeight='700';element.style.lineHeight='30px';
     element.textContent=brand.initial;
     element.setAttribute('aria-label',`Select ${card.name}, ${card.developer}`);
     marker.setLngLat([card.longitude,card.latitude]).addTo(instance);
    }
   } catch { /* Source updates can invalidate cluster IDs; the next idle event retries. */ }
  };
  instance.on('idle',update);
  void update();
  return()=>{disposed=true;request++;instance.off('idle',update);paintCluster(null);marker.remove();};
 },[activeKey,hoverKey,cards,ready]);
 useEffect(()=>{const instance=map.current;if(ready&&instance)instance.setPadding(focusPadding(focusArea,instance.getCanvas()));},[ready,focusArea]);
 useEffect(()=>{
  const instance=map.current,card=cards.find(c=>c.key===activeKey);
  if(!ready||!instance)return;
  if(selectionSeen.current.key===activeKey&&selectionSeen.current.sequence===focusSequence)return;
  selectionSeen.current={key:activeKey,sequence:focusSequence};
  if(!card||!hasCoordinates(card))return;
  let disposed=false;
  const request=++clusterRequest.current;
  void (async()=>{
   try {
    const zoom=await siteExpansionZoom(instance.getSource('sites') as GeoJSONSource,instance.queryRenderedFeatures({layers:['site-clusters']}),card.key,instance.getZoom());
    if(disposed||request!==clusterRequest.current)return;
    instance.easeTo({center:[card.longitude,card.latitude],...(zoom===undefined?{}:{zoom:Math.min(instance.getMaxZoom(),zoom)}),duration:reducedMotion()?0:450});
   } catch {
    if(!disposed&&request===clusterRequest.current)instance.easeTo({center:[card.longitude,card.latitude],duration:reducedMotion()?0:450});
   }
  })();
  return()=>{disposed=true;};
 },[activeKey,focusSequence,ready,cards]);
 useEffect(()=>{
  const instance=map.current;if(!ready||!instance||!camera)return;
  const published=publishedCamera.current;
  // Camera values echoed through the URL must never undo an in-progress map interaction.
  if(published&&Math.abs(published.lng-camera.lng)<.00002&&Math.abs(published.lat-camera.lat)<.00002&&Math.abs(published.zoom-camera.zoom)<.01)return;
  const center=instance.getCenter();
  if(Math.abs(center.lng-camera.lng)>.001||Math.abs(center.lat-camera.lat)>.001||Math.abs(instance.getZoom()-camera.zoom)>.02)instance.jumpTo({center:[camera.lng,camera.lat],zoom:camera.zoom});
 },[camera?.lng,camera?.lat,camera?.zoom,ready]);
 function fitAll(){
  const mapped=cards.filter(hasCoordinates);
  if(!map.current||!mapped.length)return;
  const canvas=map.current.getCanvas();
  const padding=focusArea?{
    left:Math.max(30,focusArea.left+24),
    top:Math.max(30,focusArea.top+24),
    right:Math.max(30,(canvas.clientWidth-focusArea.right)+24),
    bottom:Math.max(30,(canvas.clientHeight-focusArea.bottom)+24)
  }:55;
  fitMapBounds(map.current,[[Math.min(...mapped.map(c=>c.longitude)),Math.min(...mapped.map(c=>c.latitude))],[Math.max(...mapped.map(c=>c.longitude)),Math.max(...mapped.map(c=>c.latitude))]],{padding,maxZoom:12,duration:reducedMotion()?0:450},fitZoomOut);
 }
 const resultCoordinates=cards.map(card=>`${card.key}:${card.latitude}:${card.longitude}`).sort().join('|');
 useEffect(()=>{if(autoFit&&ready)fitAll();},[autoFit,ready,resultCoordinates]);
 return <aside className="site-map-panel" aria-label="Explore developments"><div className="site-map" ref={container}/>{simpleAttribution&&<div className={`site-map-attribution${attributionOpen?' is-open':''}`}><div id={attributionId} className="site-map-attribution-reveal" inert={!attributionOpen} aria-hidden={!attributionOpen}><div className="site-map-attribution-text"><a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">© OpenMapTiles</a><span> · </span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a></div></div><button type="button" className="site-map-attribution-toggle" aria-label="Map attribution" aria-expanded={attributionOpen} aria-controls={attributionId} onClick={()=>{attributionTouched.current=true;setAttributionOpen(open=>!open);}}><svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="currentColor"/><path d="M10 9v5" stroke="white" strokeWidth="2"/><circle cx="10" cy="6" r="1" fill="white"/></svg></button></div>}{focusArea&&<div className="site-map-focus-boundary" style={{left:focusArea.left,top:focusArea.top,width:Math.max(0,focusArea.right-focusArea.left),height:Math.max(0,focusArea.bottom-focusArea.top)}} aria-hidden="true"><span className="site-map-focus-badge">Search area</span></div>}<button type="button" className="site-map-fit" onClick={fitAll} disabled={!ready}>Show all matching developments</button>{status&&<p className="site-map-status" role="status">{status}</p>}{choices.length>0&&<div className="site-map-choices" aria-label="Developments at this location"><button className="site-map-close" onClick={()=>setChoices([])} aria-label="Close location choices">×</button><p>Developments at this location</p>{choices.map(c=><button key={c.key} onClick={()=>{latest.current.onSelect(c.key);setChoices([]);}}>{c.name}<span>{c.developer}</span></button>)}</div>}</aside>;
}
