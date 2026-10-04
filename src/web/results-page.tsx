import type { ReactNode } from 'react';
import { Gallery } from './gallery';
import type { Collection } from './groups';

/** Shared by directory destinations and saved favourites. */
export function ResultsPage({ title, description, eyebrow, back, collections, favouritesOnly = false, includeUnclassified = false, places, initialImage, builderOverview, children }: {
 title: ReactNode; description: string; eyebrow: ReactNode; back?: { href: string; label: string };
 builderOverview?: {map:ReactNode;counts:Record<string,number>};
 initialImage?: string;
 places?: Record<string,string[]>; collections: Collection[]; favouritesOnly?: boolean; includeUnclassified?: boolean; children?: ReactNode;
}) {
 return <main className="results-page">
  <Gallery collections={collections} favouritesOnly={favouritesOnly} includeUnclassified={includeUnclassified}
   places={places} initialImage={initialImage} introduction={{ title, description, eyebrow, back, ...builderOverview }}/>
  {children}
 </main>;
}
