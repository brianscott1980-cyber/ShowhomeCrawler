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
  const element=header.current;if(!element)return;
  const measure=()=>document.documentElement.style.setProperty('--site-header-height',`${element.getBoundingClientRect().height}px`);
  measure();const observer=new ResizeObserver(measure);observer.observe(element);
  return()=>observer.disconnect();
 },[]);

 useEffect(()=>{
  let frame=0;
  const update=()=>{frame=0;const mobile=window.matchMedia?.('(max-width:700px)').matches;const bottom=header.current?.getBoundingClientRect().bottom??0;document.querySelectorAll<HTMLElement>('main .directory-toolbar').forEach(toolbar=>toolbar.classList.toggle('is-mobile-stuck',Boolean(mobile&&toolbar.getBoundingClientRect().top<=bottom+1)));};
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);schedule();
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);};
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
