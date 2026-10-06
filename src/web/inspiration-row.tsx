'use client';
import {Children,useEffect,useRef,useState,type ComponentProps,type ReactNode} from 'react';
import {flushSync} from 'react-dom';
import {CardResults} from './card-results';

/** Rotate real cards after each slide so the loop never needs duplicate interactive cards. */
export function InspirationRow({children}:{children:ReactNode}){
 const cards=Children.toArray(children),track=useRef<HTMLDivElement>(null),viewport=useRef<HTMLDivElement>(null);
 const [offset,setOffset]=useState(0),[columns,setColumns]=useState(4);
 const hovered=useRef(false),focused=useRef(false),control=useRef<()=>void>(()=>{}),reset=useRef<()=>void>(()=>{});
 useEffect(()=>{
  const element=track.current,container=viewport.current;if(!element||!container||cards.length<2)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let animation:Animation|null=null,timer:ReturnType<typeof setTimeout>|undefined,visible=false,disposed=false;
  const blocked=()=>hovered.current||focused.current||!visible||document.hidden||reduced.matches;
  const schedule=()=>{clearTimeout(timer);if(!blocked()&&!disposed)timer=setTimeout(slide,3600);};
  const update=()=>{if(blocked()){clearTimeout(timer);animation?.pause();}else if(animation)animation.play();else schedule();};
  const slide=()=>{
   if(blocked()||disposed)return;
   const first=element.firstElementChild as HTMLElement|null;if(!first)return;
   const pitch=first.getBoundingClientRect().width+parseFloat(getComputedStyle(element).columnGap||'0');
   animation=element.animate([
    {transform:'translateX(0)',offset:0},
    {transform:'translateX(7px)',offset:.12},
    {transform:`translateX(${-pitch-5}px)`,offset:.85},
    {transform:`translateX(${-pitch}px)`,offset:1}
   ],{duration:1150,easing:'cubic-bezier(.22,.75,.18,1)',fill:'forwards'});
   animation.onfinish=()=>{if(disposed)return;flushSync(()=>setOffset(value=>(value+1)%cards.length));animation?.cancel();animation=null;schedule();};
  };
  reset.current=()=>{animation?.cancel();animation=null;clearTimeout(timer);};
  const measure=()=>setColumns(Number(getComputedStyle(container).getPropertyValue('--inspiration-columns'))||4);
  measure();const resize=new ResizeObserver(measure);resize.observe(container);
  const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??false;update();});observer.observe(container);
  control.current=update;document.addEventListener('visibilitychange',update);reduced.addEventListener('change',update);
  return()=>{disposed=true;clearTimeout(timer);animation?.cancel();resize.disconnect();observer.disconnect();document.removeEventListener('visibilitychange',update);reduced.removeEventListener('change',update);control.current=()=>{};reset.current=()=>{};};
 },[cards.length]);
 return <div className="inspiration-loop" ref={viewport} aria-label="Ideas worth saving"
  onPointerEnter={()=>{hovered.current=true;control.current();}} onPointerLeave={()=>{hovered.current=false;control.current();}}
  onFocusCapture={()=>{focused.current=true;control.current();}} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget)){focused.current=false;control.current();}}}>
  <div className="inspiration-viewport"><div ref={track} className="home-featured-grid inspiration-track">
   {cards.map((_,index)=>{const position=(offset+index)%cards.length;return <div className="inspiration-slot" key={cards[position] && (cards[position] as {key?:string}).key || position} inert={index>=columns}>{cards[position]}</div>;})}
  </div></div>
  <div className="inspiration-controls"><button type="button" aria-label="Previous ideas" onClick={()=>{reset.current();setOffset(value=>(value-1+cards.length)%cards.length);}}>‹</button><button type="button" aria-label="Next ideas" onClick={()=>{reset.current();setOffset(value=>(value+1)%cards.length);}}>›</button></div>
 </div>;
}

export function GalleryCardResults({featured,...props}:ComponentProps<typeof CardResults>&{featured:boolean}){
 return featured?<InspirationRow>{props.children}</InspirationRow>:<CardResults {...props}/>;
}
