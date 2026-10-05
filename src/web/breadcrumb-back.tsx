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
 const samePage=target.split(/[?#]/)[0]===href.split(/[?#]/)[0];
 return <Link data-breadcrumb="true" className={className} href={target}>{samePage?children:'← Back'}</Link>;
}
