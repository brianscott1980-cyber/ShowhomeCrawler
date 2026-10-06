'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import type {SiteCard} from './site-filters';
import {RollingCount} from './rolling-count';
type Counts=Record<string,number>;
const Context=createContext<{counts:Counts;update:(counts:Counts)=>void;mapCards:SiteCard[]|null;updateMapCards:(cards:SiteCard[])=>void}|null>(null);
export function DirectoryCountProvider({children}:{children:ReactNode}){
 const [counts,update]=useState<Counts>({});
 const [mapCards,updateMapCards]=useState<SiteCard[]|null>(null);
 return <Context.Provider value={{counts,update,mapCards,updateMapCards}}>{children}</Context.Provider>;
}
export function DirectoryCounts({initial}:{initial:Counts}){
 const context=useContext(Context);
 return <dl className="directory-intro-counts" aria-live="polite">{Object.entries(initial).map(([label,value])=><div key={label}><dt>{label}</dt><dd><RollingCount key={context?.counts[label]??value} value={context?.counts[label]??value}/></dd></div>)}</dl>;
}
export function useDirectoryCounts(counts:Counts){
 const update=useContext(Context)?.update;
 const signature=JSON.stringify(counts);
 useEffect(()=>{update?.(JSON.parse(signature));},[update,signature]);
}

export function useDirectoryMapCards(initial:SiteCard[]){return useContext(Context)?.mapCards??initial;}
export function usePublishDirectoryMapCards(cards:SiteCard[],ready=true){
 const update=useContext(Context)?.updateMapCards;
 const signature=cards.map(card=>card.key).sort().join('|');
 useEffect(()=>{if(ready)update?.(cards);},[update,signature,ready]);
}

export function useDirectoryMapPending(){return useContext(Context)?.mapCards===null;}
