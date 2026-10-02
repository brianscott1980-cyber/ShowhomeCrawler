import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { analyticsSource, analyticsSetup } from '../web/analytics';
import './globals.css';
import './results.css';
import {siteUrl,siteTitle,siteDescription} from '../web/seo';
import {Navigation} from '../web/navigation';
export const metadata: Metadata = { metadataBase:new URL(siteUrl), title:siteTitle, description:siteDescription, robots:{index:true,follow:true,googleBot:{'max-image-preview':'large'}}, openGraph:{type:'website',siteName:'Showhome Explorer',title:siteTitle,description:siteDescription,locale:'en_GB'}, twitter:{card:'summary',title:siteTitle,description:siteDescription}, verification:{google:process.env.GOOGLE_SITE_VERIFICATION??'_akuDjLe5VYt-An4hTdfDDGvfxLiTKqghxnJxU4VDGE'} };
export default function RootLayout({ children }: { children: React.ReactNode }) {
 return <html lang="en"><body><header className="site-header"><Link href="/" className="brand">SHOWHOME<span>EXPLORER</span></Link><Navigation/></header>{children}<footer>Explore interiors from UK showhomes. Photography shows example interiors and may be shared across homes and developments.</footer><Script src={analyticsSource} strategy="afterInteractive"/><Script id="google-analytics" strategy="afterInteractive">{analyticsSetup}</Script></body></html>;
}
