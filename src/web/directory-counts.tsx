'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {RollingCount} from './rolling-count';
type Counts=Record<string,number>;
const Context=createContext<{counts:Counts;update:(counts:Counts)=>void}|null>(null);
export function DirectoryCountProvider({children}:{children:ReactNode}){
 const [counts,update]=useState<Counts>({});
 return <Context.Provider value={{counts,update}}>{children}</Context.Provider>;
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
