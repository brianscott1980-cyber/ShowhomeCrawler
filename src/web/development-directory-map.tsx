'use client';
import {DeferredFeature} from './deferred-feature';
import {lazy,Suspense,useState} from 'react';
import {useDirectoryMapCards,useDirectoryMapPending} from './directory-counts';
import {hasCoordinates} from './map-coordinates';
import type {SiteCard} from './site-filters';
const SiteMap=lazy(()=>import('./site-map').then(module=>({default:module.SiteMap})));

export function DevelopmentDirectoryMap({initialCards,initialLoading=false}:{initialCards:SiteCard[];initialLoading?:boolean}){
 const cards=useDirectoryMapCards(initialCards);
 const pending=useDirectoryMapPending()&&initialLoading;
 const [unavailable,setUnavailable]=useState(false);
 return <div className="development-directory-map">
  <DeferredFeature><Suspense fallback={<p className="subtle">Loading development map…</p>}>
   <SiteMap cards={cards} autoFit simpleAttribution activeKey={null} onBoundsChange={()=>{}} onUnavailable={()=>setUnavailable(true)} onSelect={key=>{const card=cards.find(card=>card.key===key);if(card?.href)window.location.assign(card.href);}}/>
  </Suspense></DeferredFeature>
  {pending&&<p className="directory-map-empty" role="status">Loading matching developments…</p>}
  {!pending&&!cards.some(hasCoordinates)&&<p className="directory-map-empty" role="status">{cards.length?'Matching developments have no mapped location.':'No developments match these filters.'}</p>}
  {unavailable&&<p className="directory-map-empty" role="status">Map unavailable.</p>}
 </div>;
}
