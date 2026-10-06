'use client';
import {useEffect,useRef,useState} from 'react';
import type {GalleryScope,GalleryPageData} from './gallery-page-data';
export function useGalleryQuery(scope:GalleryScope|undefined,initial:GalleryPageData|undefined,filters:Record<string,string>,favourites:string[],initialImage?:string,ready=true){
 const criteria={scope,filters,...(scope?.kind==='favourites'?{favourites:[...favourites].sort()}:{}),...(initialImage?{selectedUid:initialImage}:{})},identity=JSON.stringify(criteria);
 const [state,setState]=useState({identity,data:initial}),[loading,setLoading]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const current=useRef(identity),controller=useRef<AbortController|null>(null),busy=useRef(false);current.current=identity;
 async function request(offset:number,limit:number,append:boolean){
  controller.current?.abort();const abort=new AbortController();controller.current=abort;busy.current=true;setLoading(true);setError('');
  try{const response=await fetch('/api/gallery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...criteria,offset,limit}),signal:abort.signal});if(!response.ok)throw new Error('Unable to load gallery. Please try again.');const data=await response.json() as GalleryPageData;if(abort.signal.aborted||current.current!==identity)return;
   setState(previous=>({identity,data:append&&previous.identity===identity?{...data,images:[...new Map([...previous.data?.images??[],...data.images].map(i=>[i.uid,i])).values()]}:data}));return data;
  }catch(error){if(!abort.signal.aborted&&current.current===identity)setError(error instanceof Error?error.message:'Unable to load gallery.');}
  finally{if(controller.current===abort){busy.current=false;setLoading(false);}}
 }
 useEffect(()=>{if(!ready||!scope||!initial||state.identity===identity&&!state.data?.pendingInitial&&!retry)return;const timer=setTimeout(()=>{void request(0,16,false);},100);return()=>{clearTimeout(timer);controller.current?.abort();};},[identity,retry,ready]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 return scope&&initial?{...state.data!,images:state.identity===identity?state.data?.images??[]:[],identity,replacing:(Boolean(state.data?.pendingInitial)||state.identity!==identity)&&!error,loading:loading||(Boolean(state.data?.pendingInitial)||state.identity!==identity)&&!error,error,retry:()=>setRetry(r=>r+1),getImage:async(offset:number)=>{try{const response=await fetch('/api/gallery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...criteria,selectedUid:undefined,offset,limit:1,imageOnly:true})});if(!response.ok)throw new Error('Unable to load image. Please try again.');const data=await response.json() as GalleryPageData;if(current.current===identity)return data.images[0];}catch(error){if(current.current===identity)setError(error instanceof Error?error.message:'Unable to load image.');}},loadMore:async(limit=16)=>{if(!busy.current&&state.identity===identity&&state.data?.hasMore)return request(state.data.nextOffset,Math.min(limit,64),true);}}:null;
}
