'use client';
import {useEffect,useRef,useState} from 'react';
import {collectionIndex,scrollCrossing,type CardEdges} from './scroll-crossing';
export interface CollectionImage {src:string;alt:string;kind?:'logo';background?:string}
interface Entry {element:HTMLElement;edges:CardEdges;advance:(direction:number)=>void}
const entries=new Set<Entry>();
let stop:undefined|(()=>void);
function register(element:HTMLElement,advance:Entry['advance']){
 const entry:Entry={element,advance,edges:element.getBoundingClientRect()};entries.add(entry);
 if(!stop){
  let scrollY=window.scrollY,frame=0;
  const reset=()=>{scrollY=window.scrollY;for(const item of entries)item.edges=item.element.getBoundingClientRect();};
  const update=()=>{frame=0;const delta=window.scrollY-scrollY;scrollY=window.scrollY;for(const item of entries){const edges=item.element.getBoundingClientRect();const direction=scrollCrossing(item.edges,edges,window.innerHeight*.5,delta);item.edges=edges;if(direction)item.advance(direction);}};
  const scroll=()=>{if(!frame)frame=requestAnimationFrame(update);};
  window.addEventListener('scroll',scroll,{passive:true});window.addEventListener('resize',reset);
  stop=()=>{window.removeEventListener('scroll',scroll);window.removeEventListener('resize',reset);cancelAnimationFrame(frame);stop=undefined;};
 }
 return ()=>{entries.delete(entry);if(!entries.size)stop?.();};
}
export function ScrollCollectionImage({images,image,description,layout}:{images?:CollectionImage[];image:string;description:string;layout:string}){
 const items=images?.length?images:[{src:image,alt:description}];
 const ref=useRef<HTMLDivElement>(null);
 const [slide,setSlide]=useState({index:0,previous:0,direction:1,sequence:0});
 const [loadedSrc,setLoadedSrc]=useState(image);
 const identity=items.map(item=>item.src).join('\n');
 useEffect(()=>{setSlide({index:0,previous:0,direction:1,sequence:0});},[identity]);
 useEffect(()=>{
  const element=ref.current?.closest<HTMLElement>('.collection-card');
  if(!element||items.length<2)return;
  return register(element,direction=>setSlide(old=>({index:collectionIndex(old.index,direction,items.length),previous:old.index,direction,sequence:old.sequence+1})));
 },[identity,layout]);
 useEffect(()=>{
  if(items.length<2||!ref.current)return;
  // Warm the next image only near the viewport, rather than downloading every collection.
  const observer=new IntersectionObserver(events=>{if(events.some(event=>event.isIntersecting)){const preload=new Image();preload.src=items[collectionIndex(slide.index,1,items.length)]!.src;observer.disconnect();}},{rootMargin:'200px'});
  observer.observe(ref.current);return ()=>observer.disconnect();
 },[identity,slide.index]);
 const current=items[slide.index]??items[0]!;
 const previous=items[slide.previous]??items[0]!;
 return <div ref={ref} className="collection-image">
  {slide.sequence>0&&<img className={`collection-image-previous${previous.kind==='logo'?' collection-image-logo':''}`} style={{background:previous.background}} src={previous.src} alt="" aria-hidden="true"/>}
  <img key={`${identity}:${slide.sequence}`} onLoad={()=>setLoadedSrc(current.src)} style={{background:current.background,...(slide.sequence&&loadedSrc!==current.src?{opacity:0}:{})}} className={`collection-image-current${current.kind==='logo'?' collection-image-logo':''}${slide.sequence&&loadedSrc===current.src?` collection-image-${slide.direction>0?'next':'back'}`:''}`} src={current.src} alt={current.alt} loading="lazy"/>
 </div>;
}
