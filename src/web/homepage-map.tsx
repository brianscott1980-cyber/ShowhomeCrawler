'use client';
import {useState,lazy,Suspense} from 'react';
import {DeferredFeature} from './deferred-feature';
import type { CoveragePoint, HomePhoto } from './homepage-data';
import {CoverageMap} from './coverage-map';
const MapPhotoSamples=lazy(()=>import('./map-photo-samples').then(m=>({default:m.MapPhotoSamples})));

export function HomepageMap({ points, photos }: { points: CoveragePoint[]; photos: HomePhoto[] }) {
 const [activeSiteIds, setActiveSiteIds] = useState<string[]>([]);
 return <div className="home-hero-map"><CoverageMap points={points} activeSiteIds={activeSiteIds}/><div style={{position:'absolute',inset:0,pointerEvents:'none'}}><DeferredFeature label=""><Suspense fallback={null}><MapPhotoSamples photos={photos} onActiveSitesChange={setActiveSiteIds}/></Suspense></DeferredFeature></div></div>;
}
