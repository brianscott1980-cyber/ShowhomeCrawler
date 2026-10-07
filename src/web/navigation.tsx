import Link from 'next/link';
export function Navigation(){return <nav aria-label="Main"><Link prefetch={false} href="/builders">Builders</Link><Link prefetch={false} href="/developments">Developments</Link><Link prefetch={false} href="/buildings">Buildings</Link><Link prefetch={false} href="/interiors">Interiors</Link><Link prefetch={false} href="/furnishings">Furnishings</Link></nav>;}
