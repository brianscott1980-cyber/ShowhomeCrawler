'use client';
import { useState } from 'react';
import type { CoveragePoint, HomePhoto } from './homepage-data';
import { CoverageMap } from './coverage-map';
import { MapPhotoSamples } from './map-photo-samples';

export function HomepageMap({ points, photos }: { points: CoveragePoint[]; photos: HomePhoto[] }) {
 const [activeSiteIds, setActiveSiteIds] = useState<string[]>([]);
 return <div className="home-hero-map"><CoverageMap points={points} activeSiteIds={activeSiteIds}/><MapPhotoSamples photos={photos} onActiveSitesChange={setActiveSiteIds}/></div>;
}
