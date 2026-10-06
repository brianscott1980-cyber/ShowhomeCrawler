'use client';
import {usePathname} from 'next/navigation';

function Lines(){return <div className="page-skeleton-lines"><i/><i/><i/></div>;}
function Visual(){return <div className="page-skeleton-visual"><i className="card-image-loading"/></div>;}
function Cards(){return <div className="page-skeleton-cards">{Array.from({length:8},(_,index)=><div className="page-skeleton-card" key={index}><Visual/><Lines/></div>)}</div>;}
export default function Loading(){
 const path=usePathname().split('/').filter(Boolean);
 const detail=path.length>1;
 const home=path.length===0;
 return <main className={`page-skeleton${detail?' page-skeleton-detail':''}`} aria-busy="true" aria-label="Loading page">
  <div aria-hidden="true">
   {detail&&<div className="page-skeleton-breadcrumb"/>}
   <div className="page-skeleton-heading">
    <div><div className="page-skeleton-title"/><Lines/></div>
    {detail&&<Lines/>}
    {home||detail||path[0]==='developments'?<Visual/>:<Lines/>}
   </div>
   <div className="page-skeleton-numbers">{[0,1,2].map(index=><div key={index}><i/><i/></div>)}</div>
   {!home&&!detail&&<div className="page-skeleton-filters">{[0,1,2,3].map(index=><div key={index}><i/><i/></div>)}</div>}
   {!home&&!detail&&<div className="page-skeleton-toolbar"><i/><i/></div>}
   <Cards/>
  </div>
 </main>;
}
