import type {Metadata} from 'next';

export const metadata:Metadata={title:'Terms of Use | Showhome Explorer',description:'Terms for using Showhome Explorer.',alternates:{canonical:'/terms'}};

export default function TermsPage(){
 return <main className="legal-page"><h1>Terms of Use</h1><p className="subtle">Last updated: 8 October 2026</p>
 <h2>Using the site</h2><p>Showhome Explorer helps you discover new homes and interior inspiration. Use the site lawfully and do not interfere with its operation, misuse accounts, or bypass security controls.</p>
 <p>For questions or content concerns, email <a href="mailto:info@showhomeexplorer.co.uk">info@showhomeexplorer.co.uk</a>.</p>
 <h2>Property information</h2><p>Prices, availability, specifications, distances and opening hours may change or contain errors. Images may show example showhomes, optional upgrades or interiors shared across house types. Automated image labels may be inaccurate. Confirm details directly with the builder before making a decision. We do not sell homes or act as an estate agent.</p>
 <h2>Images and links</h2><p>Photography, logos and other materials remain the property of their respective owners. Viewing or saving favourites does not grant permission to reproduce or commercially use them. External websites have their own terms and privacy policies.</p>
 <h2>Availability and responsibility</h2><p>We may update or temporarily suspend the site. We do not guarantee uninterrupted access or complete, current information. Nothing in these terms excludes liability that cannot lawfully be excluded or affects your statutory rights.</p>
 </main>;
}
