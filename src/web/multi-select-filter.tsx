'use client';
import {colourPreview} from './colour-preview';
import {FilterPendingContext} from './directory-filters';
import {useContext,useEffect,useId,useRef,useState,type CSSProperties} from 'react';
import {selectedValues,selectionValue} from './filter-selection';
export type FilterOption={value:string;label:string};
export function MultiSelectFilter({label,value,options,onChange,colourSwatches=false}:{colourSwatches?:boolean;label:string;value:string;options:(string|FilterOption)[];onChange:(value:string)=>void}){
 const pending=useContext(FilterPendingContext);
 useEffect(()=>{if(pending&&details.current)details.current.open=false;},[pending]);
 const id=useId(),details=useRef<HTMLDetailsElement>(null),[query,setQuery]=useState('');
 const selected=selectedValues(value);
 const supplied=options.map(option=>typeof option==='string'?{value:option,label:option}:option);
 const all=[...supplied,...selected.filter(value=>!supplied.some(option=>option.value===value)).map(value=>({value,label:value}))];
 const widthWeight=useRef(Math.min(28,Math.max(12,...supplied.map(option=>option.label.length))));
 const selectionText=selected.map(value=>all.find(option=>option.value===value)?.label??value).join(', ');
 const shown=all.filter(option=>option.label.toLowerCase().includes(query.toLowerCase()));
 useEffect(()=>{const close=(e:PointerEvent)=>{if(details.current&&!details.current.contains(e.target as Node))details.current.open=false;};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
 return <div className={`multi-filter${selected.length?' has-selection':''}`} style={{'--filter-weight':widthWeight.current} as CSSProperties}><span id={id}>{label}</span><details ref={details} onToggle={()=>{if(!details.current?.open)setQuery('');}} onKeyDown={e=>{if(e.key==='Escape'&&details.current){details.current.open=false;details.current.querySelector('summary')?.focus();}}}>
  <summary aria-disabled={pending} tabIndex={pending?-1:0} onClick={event=>{if(pending)event.preventDefault();}} onKeyDown={event=>{if(pending)event.preventDefault();}} aria-labelledby={`${id} ${id}-selection`} aria-controls={`${id}-options`}><span className="multi-filter-selection" id={`${id}-selection`} title={selectionText||undefined}>{colourSwatches&&selected.length===1&&colourPreview(selectionText)&&<span className="filter-colour-swatch" aria-hidden="true" style={{background:colourPreview(selectionText)}}/>}{selected.length===0?'All':selected.length===1?selectionText:'Multiple'}</span>{pending?<span className="results-update-spinner" aria-hidden="true"/>:<svg className="filter-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>}</summary>
  <div className="multi-filter-panel" id={`${id}-options`} role="group" aria-labelledby={id}>
   {all.length>6&&<input disabled={pending} type="search" aria-label={`Search ${label.toLowerCase()} options`} placeholder="Search options…" value={query} onChange={e=>setQuery(e.target.value)}/>}
   {selected.length>0&&<button disabled={pending} type="button" onClick={()=>onChange('')}>Clear selection</button>}
   <div className="multi-filter-options">{shown.map(option=><label key={option.value}><input disabled={pending} type="checkbox" aria-label={option.label} checked={selected.includes(option.value)} onChange={e=>onChange(selectionValue(e.target.checked?[...selected,option.value]:selected.filter(v=>v!==option.value)))}/><span>{colourSwatches&&colourPreview(option.label)&&<span className="filter-colour-swatch" aria-hidden="true" style={{background:colourPreview(option.label)}}/>}{option.label}{!supplied.some(o=>o.value===option.value)?' (no matches)':''}</span></label>)}{!shown.length&&<p>No matching options</p>}</div>
  </div>
 </details>{selected.length>0&&<button disabled={pending} className="filter-clear" type="button" aria-label={`Clear ${label.toLowerCase()} filter`} title={`Clear ${label.toLowerCase()}`} onClick={()=>{onChange('');if(details.current){details.current.open=false;details.current.querySelector('summary')?.focus();}}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>}</div>;
}
