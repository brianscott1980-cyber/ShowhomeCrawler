'use client';
import {createContext,useContext,type ReactNode} from 'react';
const empty:Record<string,string>={};
const Context=createContext(empty);
export function FixedPageFilters({filters,children}:{filters:Record<string,string>;children:ReactNode}){return <Context.Provider value={filters}>{children}</Context.Provider>;}
export function useFixedPageFilters(){return useContext(Context);}
export function fixedFilterLabel(label:string,filters:Record<string,string>){const key:Record<string,string>={Builders:'developer',Colours:'colour',Developments:'site','Building Types':'building'};return Boolean(filters[key[label]??'']);}
