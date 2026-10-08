'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';

const sections=['Builders','Developments','Buildings','Interiors','Furnishings'];

export function Navigation(){
 const pathname=usePathname();
 return <nav aria-label="Main">{sections.map(label=>{
  const href=`/${label.toLowerCase()}`;
  const active=pathname===href||pathname?.startsWith(`${href}/`);
  return <Link key={href} prefetch={false} href={href} aria-current={active?'page':undefined}>{label}</Link>;
 })}</nav>;
}
