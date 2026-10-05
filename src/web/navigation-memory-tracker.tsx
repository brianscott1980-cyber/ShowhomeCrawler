'use client';
import {useEffect} from 'react';
import {rememberPageSource} from './navigation-memory';

export function NavigationMemoryTracker(){
 useEffect(()=>{
  const remember=(event:MouseEvent)=>{
   if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
   const link=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('a[href]'):null;
   if(!link||link.hasAttribute('download')||link.dataset.breadcrumb!==undefined||link.target&&link.target!=='_self')return;
   const target=new URL(link.href,window.location.origin);
   if(target.origin!==window.location.origin||target.pathname===window.location.pathname)return;
   try {rememberPageSource(window.sessionStorage,window.location.pathname+window.location.hash,target.pathname);}catch { /* Navigation still works when storage is unavailable. */ }
  };
  document.addEventListener('click',remember,true);
  return()=>document.removeEventListener('click',remember,true);
 },[]);
 return null;
}
