import {NavigationMemoryTracker} from '../web/navigation-memory-tracker';
import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { analyticsSource, analyticsSetup } from '../web/analytics';
import './globals.css';
import './results.css';
import './filter-controls.css';
import {siteUrl,siteTitle,siteDescription} from '../web/seo';
import {Navigation} from '../web/navigation';
import {AccountMenu} from '../web/account-menu';
import {SiteHeader} from '../web/site-header';
export const metadata: Metadata = { metadataBase:new URL(siteUrl), title:siteTitle, description:siteDescription, robots:{index:true,follow:true,googleBot:{'max-image-preview':'large'}}, openGraph:{type:'website',siteName:'Showhome Explorer',title:siteTitle,description:siteDescription,locale:'en_GB'}, twitter:{card:'summary',title:siteTitle,description:siteDescription}, verification:{google:process.env.GOOGLE_SITE_VERIFICATION??'_akuDjLe5VYt-An4hTdfDDGvfxLiTKqghxnJxU4VDGE'} };
export default function RootLayout({ children }: { children: React.ReactNode }) {
 return <html lang="en"><body><NavigationMemoryTracker/><SiteHeader><Link href="/" className="brand"><img src="/brand/uk-showhome-explorer.svg" alt="UK Showhome Explorer" width={640} height={152}/></Link><div className="header-controls"><Navigation/><AccountMenu/></div></SiteHeader>{children}<footer>Explore interiors from UK showhomes. Photography shows example interiors and may be shared across homes and developments. Location data: <a href="https://www.geonames.org/">GeoNames</a> (<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>).</footer><Script src={analyticsSource} strategy="afterInteractive"/><Script id="google-analytics" strategy="afterInteractive">{analyticsSetup}</Script></body></html>;
}
