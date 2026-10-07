'use client';
import {useFixedPageFilters} from './fixed-page-filters';
import {useEffect,useRef,useState} from 'react';
import type {DirectoryKind,DirectoryPageData,DirectoryRequest} from './directory-page-data';
const keysByKind={builders:['region','radius','order'],locations:['developer','minBeds','maxBeds','minPrice','maxPrice','radius','order'],buildings:['developer','bedrooms','location','site','type','order'],interiors:['developer','bedrooms','location','site','type','building','order']};
export function useDirectoryQuery<T>(kind:DirectoryKind,filters:Record<string,string>,point:DirectoryRequest['point'],initial?:DirectoryPageData<T>,keys?:string[],selectedKey?:string,ready=true){
 const fixedFilters=useFixedPageFilters();
 const criteria={kind,...(Object.keys(fixedFilters).length?{fixedFilters}:{}),filters:Object.fromEntries(keysByKind[kind].map(key=>[key,filters[key]??''])),point:point??null,...(keys!==undefined?{keys:[...keys].sort()}:{}),...(selectedKey?{selectedKey}:{})};
 const identity=JSON.stringify(criteria);
 const [state,setState]=useState({identity,data:initial,pending:Boolean(initial?.pendingInitial)});
 const [loading,setLoading]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const active=useRef(identity),controller=useRef<AbortController|null>(null),busy=useRef(false);
 active.current=identity;
 async function fetchPage(offset:number,limit:number,append:boolean){
  controller.current?.abort();const request=new AbortController();controller.current=request;busy.current=true;setLoading(true);setError('');
  try{
   const response=await fetch('/api/directory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...criteria,offset,limit}),signal:request.signal});
   if(!response.ok)throw new Error('Unable to load results. Please try again.');
   const data=await response.json() as DirectoryPageData<T>;
   if(request.signal.aborted||active.current!==identity)return;
   setState(previous=>({identity,pending:false,data:append&&previous.identity===identity?{...data,cards:[...new Map([...previous.data?.cards??[],...data.cards].map(card=>[(card as {key?:string;slug?:string}).key??(card as {slug?:string}).slug,card])).values()]}:data}));
  }catch(error){if(!request.signal.aborted&&active.current===identity)setError(error instanceof Error?error.message:'Unable to load results.');}
  finally{if(controller.current===request){busy.current=false;setLoading(false);}}
 }
 useEffect(()=>{
  if(!initial||!ready)return;
  if(state.identity===identity&&!state.pending&&!retry)return;
  const timer=setTimeout(()=>{void fetchPage(0,16,false);},80);
  return()=>{clearTimeout(timer);controller.current?.abort();};
 },[identity,retry,Boolean(initial),ready]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 return initial?{...state.data!,pendingInitial:state.pending,replacing:(state.pending||state.identity!==identity)&&!error,loading:loading||(state.pending||state.identity!==identity)&&!error,error,identity,loadMore:(limit=16)=>{if(!busy.current&&state.identity===identity&&state.data?.hasMore)void fetchPage(state.data.nextOffset,Math.min(64,limit),true);},retry:()=>setRetry(value=>value+1)}:null;
}
export function DirectoryQueryStatus({query,visible=false}:{query:{loading:boolean;error:string;retry:()=>void}|null;visible?:boolean}){
 if(!query)return null;
 return <><p className={visible?"directory-update-status":"sr-only"} role="status" aria-live="polite">{query.loading?<>{visible&&<span className="results-update-spinner" aria-hidden="true"/>}<span className="sr-only">Updating Results…</span></>:''}</p>{query.error&&<p role="alert" className="directory-query-error">{query.error} <button type="button" onClick={query.retry}>Retry</button></p>}</>;
}
