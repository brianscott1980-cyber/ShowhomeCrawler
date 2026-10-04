'use client';
import {useEffect,useId,useRef,useState,type CSSProperties} from 'react';
import {selectedValues,selectionValue} from './filter-selection';
export type FilterOption={value:string;label:string};
export function MultiSelectFilter({label,value,options,onChange}:{label:string;value:string;options:(string|FilterOption)[];onChange:(value:string)=>void}){
 const id=useId(),details=useRef<HTMLDetailsElement>(null),[query,setQuery]=useState('');
 const selected=selectedValues(value);
 const supplied=options.map(option=>typeof option==='string'?{value:option,label:option}:option);
 const all=[...supplied,...selected.filter(value=>!supplied.some(option=>option.value===value)).map(value=>({value,label:value}))];
 const widthWeight=useRef(Math.min(28,Math.max(12,...supplied.map(option=>option.label.length))));
 const shown=all.filter(option=>option.label.toLowerCase().includes(query.toLowerCase()));
 useEffect(()=>{const close=(e:PointerEvent)=>{if(details.current&&!details.current.contains(e.target as Node))details.current.open=false;};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
 return <div className="multi-filter" style={{'--filter-weight':widthWeight.current} as CSSProperties}><span id={id}>{label}</span><details ref={details} onToggle={()=>{if(!details.current?.open)setQuery('');}} onKeyDown={e=>{if(e.key==='Escape'&&details.current){details.current.open=false;details.current.querySelector('summary')?.focus();}}}>
  <summary aria-labelledby={`${id} ${id}-selection`} aria-controls={`${id}-options`}><span className="multi-filter-selection" id={`${id}-selection`}>{selected.length===0?'All':selected.length===1?(all.find(o=>o.value===selected[0])?.label??selected[0]):'Multiple'}</span><span aria-hidden="true">⌄</span></summary>
  <div className="multi-filter-panel" id={`${id}-options`} role="group" aria-labelledby={id}>
   {all.length>6&&<input type="search" aria-label={`Search ${label.toLowerCase()} options`} placeholder="Search options…" value={query} onChange={e=>setQuery(e.target.value)}/>}
   {selected.length>0&&<button type="button" onClick={()=>onChange('')}>Clear selection</button>}
   <div className="multi-filter-options">{shown.map(option=><label key={option.value}><input type="checkbox" aria-label={option.label} checked={selected.includes(option.value)} onChange={e=>onChange(selectionValue(e.target.checked?[...selected,option.value]:selected.filter(v=>v!==option.value)))}/><span>{option.label}{!supplied.some(o=>o.value===option.value)?' (no matches)':''}</span></label>)}{!shown.length&&<p>No matching options</p>}</div>
  </div>
 </details></div>;
}
