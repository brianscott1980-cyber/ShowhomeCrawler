'use client';
import {useEffect,useId,useRef,useState} from 'react';
import type {ImageCategorisation} from '../reports/report';
import {ColourSwatch} from './colour-swatch';
import {interiorTags} from './interior-tags';

const colourLabel=(value:string)=>value.trim().toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
const unique=(values:string[])=>{const tags=new Map<string,string>();for(const value of values){const label=value.trim(),key=label.toLowerCase();if(label&&!tags.has(key))tags.set(key,label);}return [...tags.values()];};
export function cardTags(category:ImageCategorisation){
 const structured=category.interiorColours;
 const primary=unique(structured?.length?structured.filter(c=>c.prominence==='dominant').flatMap(c=>c.colours).map(colourLabel):(category.colours??[]).slice(0,3).map(colourLabel));
 const ordered=unique([...primary,...(structured??[]).flatMap(c=>c.colours).map(colourLabel),...(category.furnishings??[]).flatMap(f=>f.colours).map(colourLabel),...(category.furnishings??[]).map(f=>f.object),...interiorTags(category).colour,...interiorTags(category).tag]);
 const interiorKeys=new Set((structured??[]).flatMap(c=>c.colours).map(c=>colourLabel(c).toLowerCase()));
 return {ordered,primary:ordered.slice(0,3),remaining:ordered.slice(3),structured:Boolean(structured?.length),isInterior:(tag:string)=>interiorKeys.has(tag.toLowerCase()),isFurnishing:(tag:string)=>(category.furnishings??[]).some(f=>f.object.toLowerCase()===tag.toLowerCase()),isFurnishingColour:(tag:string)=>(category.furnishings??[]).some(f=>f.colours.some(c=>c.toLowerCase()===tag.toLowerCase()))};
}
export function fittingTagCount(width:number,widths:number[],gap:number,moreWidth:number){
 if(widths.reduce((sum,value)=>sum+value,0)+Math.max(0,widths.length-1)*gap<=width)return widths.length;
 let used=moreWidth,count=0;for(const value of widths){if(used+gap+value>width)break;used+=gap+value;count++;}return count;
}
export function ImageCardTags({category,selected,onTag,onInteriorColour,interiorSelected,onFurnishing,onFurnishingColour,onFilterApplied,furnishingColourScope=false}:{category:ImageCategorisation;selected:(tag:string)=>boolean;onTag:(tag:string)=>void;onInteriorColour:(colour:string)=>void;interiorSelected:(colour:string)=>boolean;onFurnishing?:(tag:string)=>void;onFurnishingColour?:(tag:string)=>void;onFilterApplied?:()=>void;furnishingColourScope?:boolean}){
 const tags=cardTags(category),[open,setOpen]=useState(false),dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),title=useId();
 useEffect(()=>{if(open)dialog.current?.showModal();},[open]);
 const row=useRef<HTMLDivElement>(null),measurements=useRef<HTMLDivElement>(null),[visibleCount,setVisibleCount]=useState(3);
 const identity=JSON.stringify(tags.ordered);
 useEffect(()=>{
  const element=row.current,strip=measurements.current;if(!element||!strip)return;
  const measure=()=>{const width=element.clientWidth;if(!width)return;const children=Array.from(strip.children) as HTMLElement[];const gap=parseFloat(getComputedStyle(element).columnGap)||5;setVisibleCount(fittingTagCount(width,children.slice(0,-1).map(child=>child.getBoundingClientRect().width),gap,children.at(-1)?.getBoundingClientRect().width??28));};
  measure();if(typeof ResizeObserver==='undefined'){window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);}
  const observer=new ResizeObserver(measure);observer.observe(element);observer.observe(strip);return()=>observer.disconnect();
 },[identity]);
 const visible=tags.ordered.slice(0,visibleCount),remaining=tags.ordered.slice(visibleCount);
 const close=()=>{setOpen(false);trigger.current?.focus();};
 const choose=(tag:string)=>{if(furnishingColourScope&&onFurnishingColour&&(tags.isInterior(tag)||tags.isFurnishingColour(tag)||(category.colours??[]).some(c=>c.trim().toLowerCase()===tag.toLowerCase())))onFurnishingColour(tag);else if(tags.isInterior(tag))onInteriorColour(tag);else if(tags.isFurnishing(tag)&&onFurnishing)onFurnishing(tag);else if(tags.isFurnishingColour(tag)&&onFurnishingColour)onFurnishingColour(tag);else onTag(tag);onFilterApplied?.();};
 return <div ref={row} className="feature-tags image-card-tag-row" onClick={event=>event.stopPropagation()}>
  {visible.map(c=><button type="button" key={c} className="tag tag-colour" aria-pressed={!furnishingColourScope&&tags.isInterior(c)?interiorSelected(c):selected(c)} onClick={()=>choose(c)} title={`Filter by ${c}`}><ColourSwatch label={c}/>{c}</button>)}
  {remaining.length>0&&<button ref={trigger} type="button" className="tag image-tags-more" aria-label={`Show ${remaining.length} more image tags`} aria-haspopup="dialog" onClick={()=>setOpen(true)}>+</button>}
  <div ref={measurements} className="image-tag-measurements" aria-hidden="true">{tags.ordered.map(tag=><span className="tag tag-colour" key={tag}><ColourSwatch label={tag}/>{tag}</span>)}<span className="tag image-tags-more">+</span></div>
  {open&&<dialog ref={dialog} className="image-tags-dialog" aria-labelledby={title} onClose={close} onClick={event=>{if(event.target===event.currentTarget){const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.current?.close();}}}>
   <div className="image-tags-dialog-heading"><h2 id={title}>More image tags</h2><button type="button" aria-label="Close image tags" onClick={()=>dialog.current?.close()}>×</button></div>
   <div className="feature-tags image-tags-dialog-tags">{remaining.map(tag=><button type="button" className="tag" key={tag} aria-pressed={!furnishingColourScope&&tags.isInterior(tag)?interiorSelected(tag):selected(tag)} onClick={()=>{choose(tag);dialog.current?.close();}}><ColourSwatch label={tag}/>{tag}</button>)}</div>
  </dialog>}
 </div>;
}
