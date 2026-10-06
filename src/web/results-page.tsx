import type {GalleryScope,GalleryPageData} from './gallery-page-data';
import {overviewCollection} from './overview-payload';
import type { ReactNode } from 'react';
import { Gallery } from './gallery';
import type { Collection } from './groups';

/** Shared by directory destinations and saved favourites. */
export function ResultsPage({ title, description, eyebrow, titleAccessory, developmentDetails, developmentLocation, counts, back, collections, favouritesOnly = false, includeUnclassified = false, places, initialImage, builderOverview, galleryScope, galleryPage, children }: {
 title: ReactNode; description: string; eyebrow: ReactNode; titleAccessory?:ReactNode; developmentDetails?:ReactNode; developmentLocation?:ReactNode; counts?:Record<string,number>; back?: { href: string; label: string };
 builderOverview?: {map:ReactNode;details:ReactNode;counts:Record<string,number>};
 galleryScope?:GalleryScope; galleryPage?:GalleryPageData;
 initialImage?: string;
 places?: Record<string,string[]>; collections: Collection[]; favouritesOnly?: boolean; includeUnclassified?: boolean; children?: ReactNode;
}) {
 const overviewOnly=Boolean(builderOverview)||Boolean(developmentDetails);
 // Overview pages show a carousel and links, so send only its previews to the browser.
 // Counts and navigation are computed from the complete database catalogue on the server.
 const previewCollections=overviewOnly?collections.map(overviewCollection):collections;
 return <main className="results-page">
  <Gallery galleryScope={galleryScope} galleryPage={galleryPage} collections={previewCollections} favouritesOnly={favouritesOnly} includeUnclassified={includeUnclassified}
   places={places} initialImage={initialImage} overviewOnly={overviewOnly} introduction={{ title, description, eyebrow, titleAccessory, developmentDetails, developmentLocation, counts, back, ...builderOverview }}/>
  {children}
 </main>;
}
