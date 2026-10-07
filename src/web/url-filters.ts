'use client';
import {useFixedPageFilters} from './fixed-page-filters';
import { useEffect, useRef, useState } from 'react';
import {shouldRestorePageFilters,incomingPageFilters} from './navigation-memory';
import {usePathname} from 'next/navigation';

/** Keep each page's criteria in this tab's session, without adding them to URLs. */
export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
 const pathname=usePathname();
 const fixed=useFixedPageFilters();
 const [filters, setFilters] = useState({...defaults,...fixed} as T);
 const [readyPath,setReadyPath]=useState<string|null>(null);
 const latest=useRef({...defaults,...fixed} as T);
 const storageKey=()=>`showhome-page-filters:${window.location.pathname}`;
 const save=(value:T)=>{try{window.sessionStorage.setItem(storageKey(),JSON.stringify(value));}catch{/* Filters remain usable without storage. */}};
 useEffect(() => {
  const read = () => {
   let saved:Record<string,string>={};
   try{if(shouldRestorePageFilters(window.location.pathname))saved=JSON.parse(window.sessionStorage.getItem(storageKey())??'{}')??{};}catch{}
   const url=new URL(window.location.href);
   const incoming=incomingPageFilters(window.location.pathname);
   const value=Object.fromEntries(Object.entries(defaults).map(([key,fallback])=>[key,fixed[key]??url.searchParams.get(key)??incoming[key]??(typeof saved[key]==='string'?saved[key]:fallback)])) as T;
   latest.current=value;setFilters(value);save(value);setReadyPath(window.location.pathname);
   // Import existing deep links once, then keep subsequent navigation clean.
   let cleaned=false;
   for(const key of Object.keys(defaults)){if(url.searchParams.has(key)){url.searchParams.delete(key);cleaned=true;}}
   if(cleaned)window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
  };
  read();
  window.addEventListener('popstate', read);
  return () => window.removeEventListener('popstate', read);
 }, [defaults,pathname,fixed]);
 function change(next: T | ((previous: T) => T)) {
  const value = {...(typeof next === 'function' ? next(latest.current) : next),...fixed} as T;
  latest.current=value;setFilters(value);save(value);setReadyPath(window.location.pathname);
 }
 return [filters, change,readyPath===pathname] as const;
}
