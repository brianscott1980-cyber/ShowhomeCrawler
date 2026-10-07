'use client';
import {cascadingFiltersEnabled} from './filter-settings';
import {FilterPendingContext} from './directory-filters';
import {useContext,useEffect,useId,useRef,useState} from 'react';
import {parseMoney} from './money-value';
const format=(value:string)=>value?new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:2}).format(Number(value)):'';
export function MoneyInput({label,value,options,onChange}:{label:string;value:string;options:number[];onChange:(value:string)=>void}){
 const pending=useContext(FilterPendingContext);
 useEffect(()=>{if(pending)setOpen(false);},[pending]);
 const id=useId(),host=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null);
 const [text,setText]=useState(format(value)),[open,setOpen]=useState(false),[error,setError]=useState(false);
 useEffect(()=>{setText(format(value));setError(false);},[value]);
 function commit(){if(pending)return;const next=parseMoney(text);if(next===null){setError(true);return;}setError(false);setText(format(next));if(next!==value)onChange(next);}
 return <div className="money-input" ref={host} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget)){commit();setOpen(false);}}}>
  <input disabled={pending} ref={input} type="text" inputMode="decimal" role="combobox" aria-label={label} aria-expanded={open} aria-controls={`${id}-options`} aria-autocomplete="list" aria-invalid={error} aria-describedby={error?`${id}-error`:undefined} value={text} placeholder="Any" onFocus={()=>setOpen(true)} onChange={event=>{setText(event.target.value);setError(false);}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();commit();setOpen(false);}if(event.key==='Escape'){setText(format(value));setError(false);setOpen(false);}if(event.key==='ArrowDown'){event.preventDefault();setOpen(true);host.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus();}}}/>
  <button disabled={pending} className="money-input-toggle" type="button" aria-label={`Show ${label.toLowerCase()} options`} aria-expanded={open} onMouseDown={event=>event.preventDefault()} onClick={()=>setOpen(previous=>!previous)}>{pending?<span className="results-update-spinner" aria-hidden="true"/>:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>}</button>
  {open&&<div className="money-input-options" id={`${id}-options`} role="listbox" aria-label={label}>{['',...options.map(String)].map(option=><button disabled={pending} key={option} type="button" role="option" aria-selected={value===option} onMouseDown={event=>event.preventDefault()} onClick={()=>{setText(format(option));setError(false);onChange(option);input.current?.focus();if(cascadingFiltersEnabled())setOpen(false);}}>{option?format(option):'Any'}</button>)}</div>}
  {error&&<span className="money-input-error" id={`${id}-error`} role="alert">Enter a valid price, e.g. £350,000.</span>}
 </div>;
}
