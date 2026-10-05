'use client';
import {useEffect,useRef} from 'react';
import {usePathname} from 'next/navigation';
import {rememberPageSource,markFilterNavigation,setIncomingPageFilters} from './navigation-memory';

export function NavigationMemoryTracker(){
 const pathname=usePathname();
 const currentPath=useRef(pathname);
 useEffect(()=>{currentPath.current=pathname;},[pathname]);
 useEffect(()=>{
  const remember=(event:MouseEvent)=>{
   if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
   const link=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('a[href]'):null;
   if(!link||link.hasAttribute('download')||link.target&&link.target!=='_self')return;
   const target=new URL(link.href,window.location.origin);
   if(target.origin!==window.location.origin||target.pathname===window.location.pathname)return;
   try {markFilterNavigation(window.sessionStorage,window.location.pathname,target.pathname,window.location.origin);if(link.dataset.filters){const values=JSON.parse(link.dataset.filters);if(values&&typeof values==='object'&&!Array.isArray(values)&&Object.values(values).every(value=>typeof value==='string'))setIncomingPageFilters(target.pathname,values);}if(link.dataset.breadcrumb===undefined)rememberPageSource(window.sessionStorage,window.location.pathname+window.location.hash,target.pathname);}catch { /* Navigation still works when storage is unavailable. */ }
  };
  const returning=()=>{try{markFilterNavigation(window.sessionStorage,currentPath.current,window.location.pathname,window.location.origin);}catch{}};
  window.addEventListener('popstate',returning,true);
  document.addEventListener('click',remember,true);
  return()=>{document.removeEventListener('click',remember,true);window.removeEventListener('popstate',returning,true);};
 },[]);
 return null;
}
