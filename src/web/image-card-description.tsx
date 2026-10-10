'use client';
import {useEffect,useId,useRef,useState} from 'react';
export function ImageCardDescription({text}:{text:string}){
 const [expanded,setExpanded]=useState(false),[overflow,setOverflow]=useState(false),paragraph=useRef<HTMLParagraphElement>(null),id=useId();
 useEffect(()=>{setExpanded(false);},[text]);
 useEffect(()=>{
  const element=paragraph.current;if(!element||expanded)return;
  const measure=()=>setOverflow(element.scrollHeight>element.clientHeight+1);
  measure();
  if(typeof ResizeObserver==='undefined'){window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);}
  const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();
 },[text,expanded]);
 return <div className="image-card-description"><p ref={paragraph} id={id} className={`subtle${expanded?' is-expanded':''}`}>{text}</p>{overflow&&<div className="image-description-toggle-slot"><button type="button" aria-controls={id} aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?'Show less':'Show more'}</button></div>}</div>;
}
