import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import {Navigation} from '../web/navigation';
export const metadata: Metadata = { title: 'Showhome Explorer', description: 'Discover showhome interiors and decor inspiration from UK developers.' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
 return <html lang="en"><body><header className="site-header"><Link href="/" className="brand">SHOWHOME<span>EXPLORER</span></Link><Navigation/></header>{children}<footer>Explore interiors from UK showhomes. Photography shows example interiors and may be shared across homes and developments.</footer></body></html>;
}
