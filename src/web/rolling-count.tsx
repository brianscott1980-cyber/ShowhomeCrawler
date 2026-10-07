'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';

export function RollingCount({ value }: { value: number }) {
 const element=useRef<HTMLSpanElement>(null);
 const [sequence,setSequence]=useState(0);
 useEffect(()=>{
  if(!element.current||typeof IntersectionObserver==='undefined')return;
  let visible=false,entered=false;
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting&&!visible){if(entered)setSequence(previous=>previous+1);entered=true;}visible=entry.isIntersecting;}},{threshold:0});
  observer.observe(element.current);return()=>observer.disconnect();
 },[]);
 const formatted = value.toLocaleString('en-GB');
 return <span ref={element} className="rolling-count">
  <span className="sr-only">{formatted}</span>
  <span key={sequence} className="rolling-count-visual" aria-hidden="true">{[...formatted].map((character, index) => {
   if (!/\d/.test(character)) return <span key={index}>{character}</span>;
   const last = 30 + Number(character);
   const style = { '--roll-end': `${-last * 1.15}em`, '--roll-delay': `${index * 80}ms` } as CSSProperties;
   return <span className="rolling-digit" key={index}><span className="rolling-digit-strip" style={style}>{Array.from({ length: last + 1 }, (_, row) => <span key={row}>{row % 10}</span>)}</span></span>;
  })}</span>
 </span>;
}
