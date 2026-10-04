'use client';
import {SiteMap} from './site-map';
import type {SiteCard} from './site-filters';
export function BuilderOverviewMap({cards}:{cards:SiteCard[]}){
 return <SiteMap cards={cards} activeKey={null} onBoundsChange={()=>{}} onUnavailable={()=>{}} onSelect={key=>{const card=cards.find(item=>item.key===key);if(card?.href)window.location.assign(card.href);}}/>;
}
