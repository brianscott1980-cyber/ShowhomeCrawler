'use client';
import {Children,useEffect,useRef,useState,type ReactNode} from 'react';

export function CardResults({children,className,label,identity,paginate=true,hasMore=false,loading=false,onLoadMore}:{children:ReactNode;className:string;label:string;identity:string;paginate?:boolean;hasMore?:boolean;loading?:boolean;onLoadMore?:(limit:number)=>void}){
 const grid=useRef<HTMLDivElement>(null),more=useRef<HTMLButtonElement>(null);
 const [pressure,setPressure]=useState(0);
 const cooldown=useRef(0);
 const [columns,setColumns]=useState(1);
 const [batch,setBatch]=useState({identity,rows:4});
 const rows=batch.identity===identity?batch.rows:4;
 const cards=Children.toArray(children);
 useEffect(()=>{
  const element=grid.current;if(!element)return;
  const measure=()=>{const tracks=getComputedStyle(element).gridTemplateColumns;setColumns(tracks&&tracks!=='none'?tracks.split(/\s+/).length:1);};
  measure();
  if(typeof ResizeObserver==='undefined')return;
  const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();
 },[className]);
 const shown=paginate?Math.min(cards.length,rows*columns):cards.length;
 const loadMore=()=>{if(loading)return;const target=(rows+4)*columns;if(target>cards.length&&hasMore){onLoadMore?.(target-cards.length);}cooldown.current=performance.now()+900;setPressure(0);setBatch({identity,rows:rows+4});};
 useEffect(()=>{
  setPressure(0);
  if((!paginate||shown>=cards.length)&&!hasMore||loading)return;
  let accumulated=0,touchY:number|null=null,decay:ReturnType<typeof setTimeout>|undefined;
  const reset=()=>{accumulated=0;setPressure(0);clearTimeout(decay);};
  const atBottom=()=>{
   const button=more.current;if(!button||document.querySelector('dialog[open]'))return false;
   const bounds=button.getBoundingClientRect();
   return bounds.top<window.innerHeight&&bounds.bottom>0&&window.scrollY+window.innerHeight>=document.documentElement.scrollHeight-2;
  };
  const push=(distance:number,target:EventTarget|null)=>{
   if(distance<=0||!atBottom()){reset();return;}
   if(performance.now()<cooldown.current)return;
   // A nested scroll area owns its own scroll gestures.
   for(let element=target instanceof Element?target:null;element&&element!==document.body;element=element.parentElement){
    if(element.scrollHeight>element.clientHeight&&/auto|scroll/.test(getComputedStyle(element).overflowY))return;
   }
   accumulated+=Math.min(distance,120);
   clearTimeout(decay);
   if(accumulated>=120){reset();loadMore();return;}
   setPressure(accumulated/120);
   decay=setTimeout(reset,900);
  };
  const wheel=(event:WheelEvent)=>{if(event.ctrlKey||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;push(event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?window.innerHeight:1),event.target);};
  const start=(event:TouchEvent)=>{touchY=event.touches.length===1?event.touches[0]!.clientY:null;};
  const move=(event:TouchEvent)=>{if(touchY===null||event.touches.length!==1)return;const next=event.touches[0]!.clientY;push(touchY-next,event.target);touchY=next;};
  const end=()=>{touchY=null;};
  const scroll=()=>{if(!atBottom())reset();};
  window.addEventListener('wheel',wheel,{passive:true});window.addEventListener('touchstart',start,{passive:true});window.addEventListener('touchmove',move,{passive:true});window.addEventListener('touchend',end,{passive:true});window.addEventListener('touchcancel',end,{passive:true});window.addEventListener('scroll',scroll,{passive:true});
  return()=>{clearTimeout(decay);window.removeEventListener('wheel',wheel);window.removeEventListener('touchstart',start);window.removeEventListener('touchmove',move);window.removeEventListener('touchend',end);window.removeEventListener('touchcancel',end);window.removeEventListener('scroll',scroll);};
 },[identity,rows,columns,paginate,cards.length,shown,hasMore,loading]);
 return <div className="card-results"><div ref={grid} className={className}>{cards.slice(0,shown)}</div>{(shown<cards.length||hasMore)&&<div className="more-results-row"><button ref={more} type="button" className="more-results" onClick={loadMore} disabled={loading}>{loading?'Loading…':`More ${label}`}<span className="more-pressure" aria-hidden="true" style={{transform:`scale(${1+Math.max(0,pressure-.7)*.5})`}}><svg viewBox="0 0 24 24"><circle className="more-pressure-outline" cx="12" cy="12" r="9"/><circle className="more-pressure-fill" cx="12" cy="12" r="7" style={{transform:`scale(${pressure})`}}/></svg></span></button></div>}</div>;
}
