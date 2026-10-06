'use client';
import {builderMapBrand} from './builder-map-brand';
import {lazy,Suspense} from 'react';
import {DeferredFeature} from './deferred-feature';
const SiteMap=lazy(()=>import('./site-map').then(m=>({default:m.SiteMap})));
import type {SiteCard} from './site-filters';
export function BuilderOverviewMap({cards}:{cards:SiteCard[]}){
 return <DeferredFeature><Suspense fallback={<p className="subtle">Loading map…</p>}><SiteMap simpleAttribution clusterColor={builderMapBrand(cards[0]?.developer??'').primary} cards={cards} activeKey={null} onBoundsChange={()=>{}} onUnavailable={()=>{}} onSelect={key=>{const card=cards.find(item=>item.key===key);if(card?.href)window.location.assign(card.href);}}/></Suspense></DeferredFeature>;
}
