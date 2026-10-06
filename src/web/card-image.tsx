'use client';
import NextImage from 'next/image';
import {useEffect,useRef,useState,type ComponentProps} from 'react';

function useImageState(source:unknown){
 const ref=useRef<HTMLImageElement>(null);
 const [settled,setSettled]=useState<{source:unknown;failed:boolean}|null>(null);
 const ready=settled?.source===source;
 useEffect(()=>{
  const image=ref.current;
  // Cached images can finish before hydration attaches their load handler.
  if(image?.complete&&image.naturalWidth>0)setSettled({source,failed:false});
 },[source]);
 return {ref,ready,failed:ready&&Boolean(settled?.failed),loaded:()=>setSettled({source,failed:false}),failedLoad:()=>setSettled({source,failed:true})};
}

function LoadingMark({failed=false}:{failed?:boolean}){
 return <i className={`card-image-loading${failed?' card-image-failed':''}`} aria-hidden="true"/>;
}

export function CardImage({onLoad,onError,style,...props}:ComponentProps<'img'>){
 const state=useImageState(props.src);
 return <span className="card-image-space">
  {(!state.ready||state.failed)&&<LoadingMark failed={Boolean(state.failed)}/>}
  <img {...props} ref={state.ref} style={{...style,opacity:state.ready&&!state.failed?style?.opacity:0}}
   onLoad={event=>{state.loaded();onLoad?.(event);}} onError={event=>{state.failedLoad();onError?.(event);}}/>
 </span>;
}

export function NextCardImage({onLoad,onError,style,showLoading=true,...props}:ComponentProps<typeof NextImage>&{showLoading?:boolean}){
 const state=useImageState(props.src);
 return <span className={`card-image-space${props.fill?' card-image-fill':''}`}>
  {showLoading&&(!state.ready||state.failed)&&<LoadingMark failed={Boolean(state.failed)}/>}
  <NextImage {...props} ref={state.ref} style={{...style,opacity:state.ready&&!state.failed?style?.opacity:0}}
   onLoad={event=>{state.loaded();onLoad?.(event);}} onError={event=>{state.failedLoad();onError?.(event);}}/>
 </span>;
}
