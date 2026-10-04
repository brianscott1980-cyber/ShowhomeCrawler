'use client';
import {useEffect,useId,useRef} from 'react';
import {LocationLabel} from './location-label';
import type {SavedLocation} from './location-preferences';

export function DistanceFilter({value,location,onChange,onChangeLocation}:{value:string;location:SavedLocation|null;onChange:(value:string)=>void;onChangeLocation:()=>void}){
 const id=useId(),details=useRef<HTMLDetailsElement>(null);
 function close(){if(details.current)details.current.open=false;}
 useEffect(()=>{const outside=(event:PointerEvent)=>{if(details.current&&!details.current.contains(event.target as Node))close();};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[]);
 return <div className={`multi-filter distance-filter${value?' has-selection':''}`}><span id={id}>Within</span><details ref={details} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();close();details.current?.querySelector('summary')?.focus();}}}>
  <summary aria-labelledby={`${id} ${id}-selection`} aria-controls={`${id}-options`}><span className="multi-filter-selection" id={`${id}-selection`}>{value?`${value} miles`:'Any distance'}</span><svg className="filter-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary>
  <div className="multi-filter-panel distance-filter-panel" id={`${id}-options`}>
   <div className="distance-filter-location"><div className="distance-filter-location-heading"><span>Your area</span><button type="button" aria-label={location?'Change location':'Set location'} onClick={()=>{close();onChangeLocation();}}>{location?'Change':'Set location'}</button></div><strong>{location?<LocationLabel location={location}/>:'No location selected'}</strong></div>
   <div className="distance-filter-options" role="group" aria-label="Distance options">{['', '5','10','25','50','100','200'].map(option=><button type="button" key={option} aria-pressed={value===option} onClick={()=>{onChange(option);close();details.current?.querySelector('summary')?.focus();}}><span>{option?`${option} miles`:'Any distance'}</span><span aria-hidden="true">{value===option?'✓':''}</span></button>)}</div>
  </div>
 </details>{value&&<button className="filter-clear" type="button" aria-label="Clear distance filter" title="Clear distance" onClick={()=>{onChange('');close();details.current?.querySelector('summary')?.focus();}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>}</div>;
}
