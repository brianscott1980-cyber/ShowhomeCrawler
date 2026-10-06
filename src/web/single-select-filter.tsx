'use client';
import {FilterPendingContext} from './directory-filters';
import {useContext,useEffect,useId,useRef} from 'react';
import type {FilterOption} from './multi-select-filter';
/** Shared custom menu for single choices; uses the same surface as multi-choice filters. */
export function SingleSelectFilter({label,value,options,onChange}:{label:string;value:string;options:FilterOption[];onChange:(value:string)=>void}){
 const pending=useContext(FilterPendingContext);
 useEffect(()=>{if(pending&&details.current)details.current.open=false;},[pending]);
 const id=useId(),details=useRef<HTMLDetailsElement>(null);
 function close(){if(details.current){details.current.open=false;details.current.querySelector('summary')?.focus();}}
 useEffect(()=>{const outside=(event:PointerEvent)=>{if(details.current&&!details.current.contains(event.target as Node))details.current.open=false;};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[]);
 return <div className="multi-filter single-select-filter"><details ref={details} onKeyDown={event=>{
  if(pending){event.preventDefault();return;}
  if(event.key==='Escape'){event.preventDefault();close();}
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
   event.preventDefault();if(!details.current)return;details.current.open=true;
   const buttons=[...details.current.querySelectorAll<HTMLButtonElement>('[role="option"]')];const current=buttons.indexOf(document.activeElement as HTMLButtonElement);
   const index=event.key==='Home'?0:event.key==='End'?buttons.length-1:current<0?Math.max(0,options.findIndex(option=>option.value===value)):(current+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[index]?.focus();
  }
 }}>
  <summary aria-disabled={pending} tabIndex={pending?-1:0} onClick={event=>{if(pending)event.preventDefault();}} aria-label={label} aria-haspopup="listbox" aria-controls={`${id}-options`}><span className="multi-filter-selection">{options.find(option=>option.value===value)?.label??value}</span>{pending?<span className="results-update-spinner" aria-hidden="true"/>:<svg className="filter-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>}</summary>
  <div className="multi-filter-panel single-select-options" id={`${id}-options`} role="listbox" aria-label={label}>{options.map(option=><button disabled={pending} type="button" role="option" key={option.value} aria-selected={value===option.value} onClick={()=>{onChange(option.value);close();}}><span>{option.label}</span><span aria-hidden="true">{value===option.value?'✓':''}</span></button>)}</div>
 </details></div>;
}
