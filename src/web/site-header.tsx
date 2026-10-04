'use client';

import {useEffect,useRef,useState,type ReactNode} from 'react';

export function SiteHeader({children}:{children:ReactNode}){
 const header=useRef<HTMLElement>(null);
 const [height,setHeight]=useState<number>();
 const [sticky,setSticky]=useState(false);

 useEffect(()=>{
  const element=header.current;
  if(!element||sticky)return;
  const measure=()=>setHeight(element.getBoundingClientRect().height);
  measure();
  const observer=new ResizeObserver(measure);
  observer.observe(element);
  return()=>observer.disconnect();
 },[sticky]);

 useEffect(()=>{
  const onScroll=()=>{
   setSticky(height!==undefined&&window.scrollY>=height);
  };
  onScroll();
  window.addEventListener('scroll',onScroll,{passive:true});
  return()=>window.removeEventListener('scroll',onScroll);
 },[height]);

 return <div className="site-header-space" style={{height}}><header ref={header} className={`site-header${sticky?' site-header-sticky':''}`}>{children}</header></div>;
}
