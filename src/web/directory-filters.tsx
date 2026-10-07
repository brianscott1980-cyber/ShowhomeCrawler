'use client';
import {createPortal} from 'react-dom';
import {cascadingFiltersEnabled} from './filter-settings';
import {createContext,Children,useEffect,useRef,useState,type ReactNode,type CSSProperties} from 'react';
export const FilterPendingContext=createContext(false);
export function DirectoryFilters({children,className='',label='Directory filters',primaryCount=2,pending=false}:{children:ReactNode;className?:string;label?:string;primaryCount?:number;pending?:boolean}){
 const [toolbar,setToolbar]=useState<Element|null>(null);
 useEffect(()=>{const main=anchor.current?.closest('main');setToolbar(main?.querySelector('.directory-toolbar .sort-control,.directory-toolbar .development-order')??main?.querySelector('.directory-toolbar')??null);},[]);
 const blocking=pending&&cascadingFiltersEnabled();
 const items=Children.toArray(children).filter(Boolean),primary=items.slice(0,primaryCount),remaining=items.slice(primaryCount);
 const anchor=useRef<HTMLDivElement>(null),row=useRef<HTMLDivElement>(null),naturalHeight=useRef(0);
 const [pinned,setPinned]=useState<{top:number;insetLeft:number;insetRight:number}|null>(null);
 const [mobile,setMobile]=useState(false),[open,setOpen]=useState(false);const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(typeof window.matchMedia!=='function')return;const query=window.matchMedia('(max-width:900px)');const update=()=>{setMobile(query.matches);if(!query.matches)setOpen(false);};update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
 useEffect(()=>{const element=dialog.current;if(!element)return;if(open){element.showModal();element.querySelectorAll('details').forEach(details=>details.open=false);}else if(element.open)element.close();},[open]);
 useEffect(()=>{
  const element=anchor.current,filters=row.current,header=document.querySelector<HTMLElement>('.site-header');
  if(!element||!filters||!header)return;
  naturalHeight.current=filters.offsetHeight;
  let frame=0;
  const measure=()=>{
   frame=0;
   const bounds=element.getBoundingClientRect();
   const mapControls=window.matchMedia('(max-width:900px)').matches&&Boolean(element.closest('.location-filter-panel')&&document.querySelector('.location-explorer'));
   const top=header.getBoundingClientRect().height;
   const content=element.closest('main')??element;
   const contentBounds=content.getBoundingClientRect(),contentStyle=getComputedStyle(content);
   const insetLeft=contentBounds.left+parseFloat(contentStyle.paddingLeft||'0');
   const insetRight=document.documentElement.clientWidth-contentBounds.right+parseFloat(contentStyle.paddingRight||'0');
   const shouldPin=!mapControls&&header.classList.contains('site-header-sticky')&&bounds.top<=top;
   if(!shouldPin)naturalHeight.current=filters.offsetHeight;
   setPinned(old=>shouldPin?(old&&old.top===top&&old.insetLeft===insetLeft&&old.insetRight===insetRight?old:{top,insetLeft,insetRight}):null);
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
  const observer=new ResizeObserver(schedule);observer.observe(header);observer.observe(element);observer.observe(filters);
  const mutations=new MutationObserver(schedule);mutations.observe(header,{attributes:true,attributeFilter:['class']});
  measure();window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();mutations.disconnect();window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);};
 },[]);
 const pinnedStyle:CSSProperties|undefined=pinned?{top:pinned.top,left:0,right:0,paddingLeft:pinned.insetLeft,paddingRight:pinned.insetRight}:undefined;
 return <FilterPendingContext.Provider value={blocking}>{toolbar&&createPortal(<button className="mobile-toolbar-filters" type="button" aria-label="All filters" aria-haspopup="dialog" onClick={()=>setOpen(true)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="white"/><circle cx="15" cy="17" r="3" fill="white"/></svg></button>,toolbar)}<div ref={anchor} className="directory-filter-space" style={pinned?{height:naturalHeight.current}:undefined}><div ref={row} style={pinnedStyle} className={`directory-filter-row ${className}${pinned?' directory-filters-pinned':''}`} role="search" aria-busy={pending} aria-label={label}>{primary}{!mobile&&<div className="directory-secondary-filters">{remaining}</div>}{mobile&&items.length>0&&<><button className="directory-drawer-toggle" disabled={blocking} type="button" onClick={()=>setOpen(true)} aria-label="All filters" aria-haspopup="dialog">{blocking?<span className="results-update-spinner" aria-hidden="true"/>:'☷'}</button><dialog ref={dialog} className="directory-filter-drawer" onClose={()=>setOpen(false)} onCancel={()=>setOpen(false)} aria-label={label}><div className="directory-drawer-heading"><h2>Filters</h2><button type="button" onClick={()=>setOpen(false)} aria-label="Close filters">×</button></div><div className="directory-drawer-fields">{items}</div><button type="button" className="directory-drawer-done" onClick={()=>setOpen(false)}>Show results</button></dialog></>}</div></div></FilterPendingContext.Provider>;
}
