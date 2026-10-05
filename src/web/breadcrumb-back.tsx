'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {rememberedPageSource} from './navigation-memory';

export function BreadcrumbBack({href,children,className}:{href:string;children:React.ReactNode;className?:string}){
 const pathname=usePathname();
 const [source,setSource]=useState<string|null>(null);
 useEffect(()=>{
  try {setSource(rememberedPageSource(window.sessionStorage,pathname,window.location.origin));}catch{setSource(null);}
 },[pathname]);
 const target=source??href.replace(/\?[^#]*/, '');
 const directoryLabels:Record<string,string>={'/builders':'builders','/developments':'developments','/buildings':'building types','/interiors':'interiors'};
 const returnLabel=source?directoryLabels[target.split(/[?#]/)[0]!]:null;
 const samePage=target.split(/[?#]/)[0]===href.split(/[?#]/)[0];
 return <Link data-breadcrumb="true" className={className} href={target}>{returnLabel?`← Return to ${returnLabel}`:samePage?children:'← Back'}</Link>;
}
