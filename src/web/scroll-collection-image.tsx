'use client';
import {useEffect,useRef,useState} from 'react';
import {collectionIndex,scrollCrossing,rowProgress,rowScrollCrossing,rowTrigger,atPageBottom,bottomRemainder,type CardEdges} from './scroll-crossing';
export interface CollectionImage {src:string;alt:string;kind?:'logo';background?:string}
interface Entry {element:HTMLElement;edges:CardEdges;progress:number;bottomAdvanced:boolean;advance:(direction:number)=>void}
interface Measurement {edges:DOMRect;progress:number;column:number;columns:number;list:boolean;large:boolean}
const entries=new Set<Entry>();
let stop:undefined|(()=>void);
function measureCards(){
 const measurements=new Map<HTMLElement,Measurement>();
 const grids=new Set([...entries].map(entry=>entry.element.parentElement).filter((grid):grid is HTMLElement=>Boolean(grid)));
 const midpoint=window.innerHeight*.5;
 for(const grid of grids){
  // Include static one-image cards so their position still occupies a column in the row.
  const cards=[...grid.children].filter((child):child is HTMLElement=>child instanceof HTMLElement&&child.classList.contains('collection-card'))
   .map(element=>({element,edges:element.getBoundingClientRect()})).sort((a,b)=>a.edges.top-b.edges.top||a.edges.left-b.edges.left);
  const rows:typeof cards[]=[];
  for(const card of cards){const last=rows.at(-1);if(last&&Math.abs(last[0]!.edges.top-card.edges.top)<2)last.push(card);else rows.push([card]);}
  for(const row of rows){
   row.sort((a,b)=>a.edges.left-b.edges.left);
   const progress=rowProgress({top:row[0]!.edges.top,bottom:Math.max(...row.map(card=>card.edges.bottom))},midpoint);
   row.forEach((card,column)=>measurements.set(card.element,{edges:card.edges,progress,column,columns:row.length,list:grid.classList.contains('directory-list'),large:grid.classList.contains('directory-large')}));
  }
 }
 return measurements;
}
function register(element:HTMLElement,advance:Entry['advance']){
 const entry:Entry={element,advance,edges:element.getBoundingClientRect(),progress:0,bottomAdvanced:false};entries.add(entry);
 entry.progress=measureCards().get(element)?.progress??0;
 if(!stop){
  let scrollY=window.scrollY,frame=0;
  const reset=()=>{scrollY=window.scrollY;const measurements=measureCards();for(const item of entries){const next=measurements.get(item.element);if(next){item.edges=next.edges;item.progress=next.progress;}}};
  const update=()=>{
   frame=0;const delta=window.scrollY-scrollY;scrollY=window.scrollY;
   const measurements=measureCards();
   const midpoint=window.innerHeight*.5;
   const bottom=atPageBottom(scrollY,window.innerHeight,document.documentElement.scrollHeight);
   for(const item of entries){
    const next=measurements.get(item.element);if(!next)continue;
    let direction=next.list?scrollCrossing(item.edges,next.edges,window.innerHeight*.5,delta):rowScrollCrossing(item.progress,next.progress,next.column,next.columns,delta,next.large);
    // At the page end, finish only cards whose usual trigger is still unreachable.
    if(delta>0&&bottom&&!item.bottomAdvanced&&bottomRemainder(next.list,next.edges,next.progress,next.column,next.columns,midpoint,next.large)){
     direction=1;item.bottomAdvanced=true;
    }else if(delta<0&&item.bottomAdvanced&&(direction===-1||(next.list?next.edges.top>midpoint:next.progress<rowTrigger(next.column,next.columns,next.large)))){
     direction=-1;item.bottomAdvanced=false;
    }
    item.edges=next.edges;item.progress=next.progress;if(direction)item.advance(direction);
   }
  };
  const scroll=()=>{if(!frame)frame=requestAnimationFrame(update);};
  window.addEventListener('scroll',scroll,{passive:true});window.addEventListener('resize',reset);
  stop=()=>{window.removeEventListener('scroll',scroll);window.removeEventListener('resize',reset);cancelAnimationFrame(frame);stop=undefined;};
 }
 return ()=>{entries.delete(entry);if(!entries.size)stop?.();};
}
export function ScrollCollectionImage({images,image,description,layout,caption=false}:{images?:CollectionImage[];image:string;description:string;layout:string;caption?:boolean}){
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
  {caption&&<span className="site-photo-caption">{(current.alt.match(/\b(home office|living room|dining room|kitchen|bathroom|bedroom|hallway|garden|exterior)\b/i)?.[0]??'Development preview').replace(/^./,letter=>letter.toUpperCase())}</span>}
 </div>;
}
