'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
/** Mount visible enhancements after the initial paint; never load offscreen features. */
export function DeferredFeature({children,label='Loading map…'}:{children:ReactNode;label?:string}){
 const ref=useRef<HTMLDivElement>(null),[ready,setReady]=useState(false);
 useEffect(()=>{
  let idle:number|undefined,timer:ReturnType<typeof setTimeout>|undefined,scheduled=false;
  const mount=()=>{if(scheduled)return;scheduled=true;observer?.disconnect();if(window.requestIdleCallback)idle=window.requestIdleCallback(()=>setReady(true),{timeout:1200});else timer=setTimeout(()=>setReady(true),150);};
  const observer=typeof IntersectionObserver==='undefined'?undefined:new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))mount();},{rootMargin:'100px'});
  if(observer&&ref.current)observer.observe(ref.current);else mount();
  return()=>{observer?.disconnect();if(idle!==undefined)window.cancelIdleCallback?.(idle);clearTimeout(timer);};
 },[]);
 return <div ref={ref} style={{height:'100%',width:'100%'}} onPointerDown={()=>setReady(true)}>{ready?children:<p className="subtle" role="status">{label}</p>}</div>;
}
