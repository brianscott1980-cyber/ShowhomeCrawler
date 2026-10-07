'use client';
import {useFixedPageFilters} from './fixed-page-filters';
import {cascadingFiltersEnabled} from './filter-settings';
import {createContext,useContext,useEffect,useState,useRef,type ReactNode} from 'react';
import type {SiteCard} from './site-filters';
import {RollingCount} from './rolling-count';
type Counts=Record<string,number>;
const Context=createContext<{builderSelection:string;setBuilderSelection:(value:string)=>void;pending:boolean;setPending:(pending:boolean)=>void;counts:Counts;update:(counts:Counts)=>void;mapCards:SiteCard[]|null;updateMapCards:(cards:SiteCard[])=>void}|null>(null);
export function DirectoryCountProvider({children}:{children:ReactNode}){
 const fixed=useFixedPageFilters();
 const [builderSelection,setBuilderSelection]=useState(fixed.developer??'');
 const [pending,setPending]=useState(false);
 const [counts,update]=useState<Counts>({});
 const [mapCards,updateMapCards]=useState<SiteCard[]|null>(null);
 return <Context.Provider value={{builderSelection,setBuilderSelection,counts,update,pending,setPending,mapCards,updateMapCards}}>{children}</Context.Provider>;
}
export function DirectoryCounts({initial}:{initial:Counts}){
 const context=useContext(Context);
 return <dl className={`directory-intro-counts${context?.pending?' is-updating':''}`} aria-busy={context?.pending} aria-live="polite">{Object.entries(initial).map(([label,value])=><div key={label}><dt>{label}</dt><dd><RollingCount key={context?.counts[label]??value} value={context?.counts[label]??value}/></dd></div>)}</dl>;
}
export function useDirectoryCounts(counts:Counts,pending=false){
 const context=useContext(Context);
 const update=context?.update;
 const setPending=context?.setPending;
 const frozen=useRef<Counts|null>(null);
 if(!cascadingFiltersEnabled()&&!frozen.current&&Object.values(counts).some(value=>value>0))frozen.current=counts;
 useEffect(()=>{setPending?.(cascadingFiltersEnabled()&&pending);return()=>setPending?.(false);},[setPending,pending]);
 const signature=JSON.stringify(cascadingFiltersEnabled()?counts:frozen.current??counts);
 useEffect(()=>{update?.(JSON.parse(signature));},[update,signature]);
}

export function useDirectoryMapCards(initial:SiteCard[]){return useContext(Context)?.mapCards??initial;}
export function usePublishDirectoryMapCards(cards:SiteCard[],ready=true){
 const update=useContext(Context)?.updateMapCards;
 const signature=cards.map(card=>card.key).sort().join('|');
 useEffect(()=>{if(ready)update?.(cards);},[update,signature,ready]);
}

export function useDirectoryMapPending(){return useContext(Context)?.mapCards===null;}

export function useDirectoryBuilderSelection(){return useContext(Context)?.builderSelection??'';}
export function usePublishDirectoryBuilderSelection(value:string){
 const update=useContext(Context)?.setBuilderSelection;
 useEffect(()=>{update?.(value);},[update,value]);
}
