'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { HomePhoto } from './homepage-data';

type Phase = 'loading' | 'focus' | 'enter' | 'hold' | 'exit' | 'restore';
const sampleSequence = {
 focus: { next: 'enter', duration: 800 },
 enter: { next: 'hold', duration: 900 },
 hold: { next: 'exit', duration: 4000 },
 exit: { next: 'restore', duration: 900 },
 restore: { next: 'loading', duration: 800 },
} as const;

export function nextSampleIndex(length: number, previous: number, random = Math.random()) {
 if (length <= 1) return 0;
 const index = Math.floor(random * (previous < 0 ? length : length - 1));
 return previous >= 0 && index >= previous ? index + 1 : index;
}

export function MapPhotoSamples({ photos, onActiveSitesChange }: { photos: HomePhoto[]; onActiveSitesChange?: (siteIds: string[]) => void }) {
 const [sample, setSample] = useState<{ index: number; position: number; motion: number; cycle: number } | null>(null);
 const [phase, setPhase] = useState<Phase>('loading');
 const failed = useRef(new Set<number>());
 const [hovered, setHovered] = useState(false);
 const [focused, setFocused] = useState(false);
 const interacting = hovered || focused;
 const [paused, setPaused] = useState(false);
 const [reducedMotion, setReducedMotion] = useState(false);
 useEffect(() => {
  if (photos.length) setSample({ index: nextSampleIndex(photos.length, -1), position: nextSampleIndex(3, -1), motion: nextSampleIndex(5, -1), cycle: 0 });
  const visibility = () => setPaused(document.hidden);
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motion = () => setReducedMotion(media.matches);
  visibility(); motion();
  document.addEventListener('visibilitychange', visibility);
  media.addEventListener('change', motion);
  return () => { document.removeEventListener('visibilitychange', visibility); media.removeEventListener('change', motion); };
 }, [photos]);
 const advance = useCallback(() => {
  const available = photos.map((_, index) => index).filter(index => !failed.current.has(index));
  setPhase('loading');
  setSample(previous => {
   if (!available.length) return null;
   const last = previous ? available.indexOf(previous.index) : -1;
   return { index: available[nextSampleIndex(available.length, last)]!, position: nextSampleIndex(3, previous?.position ?? -1), motion: nextSampleIndex(5, previous?.motion ?? -1), cycle: (previous?.cycle ?? 0) + 1 };
  });
 }, [photos]);
 useEffect(() => {
  const focused = phase !== 'loading' && phase !== 'restore';
  onActiveSitesChange?.(focused && sample ? photos[sample.index]?.siteIds ?? [] : []);
 }, [phase, sample, photos, onActiveSitesChange]);
 useEffect(() => {
  if (phase === 'loading' || paused || reducedMotion || (interacting && phase === 'hold')) return;
  const step = sampleSequence[phase];
  const timer = window.setTimeout(() => phase === 'restore' ? advance() : setPhase(step.next), step.duration);
  return () => window.clearTimeout(timer);
 }, [phase, paused, reducedMotion, interacting, advance]);
 if (!sample) return null;
 const photo = photos[sample.index];
 if (!photo) return null;
 const visible = phase === 'enter' || phase === 'hold' || (reducedMotion && phase === 'focus');
 return <div className="map-photo-samples">
  <figure key={sample.cycle} data-phase={phase} className={`map-photo-sample map-photo-position-${sample.position} map-photo-motion-${sample.motion}${visible ? ' is-visible' : ''}${interacting ? ' is-interacting' : ''}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
   <a className="map-photo-link" href={photo.houseTypeHref} tabIndex={visible ? 0 : -1} aria-label={`Explore ${photo.houseType ?? photo.builder} interiors`}>
   <div className="map-photo-window"><img src={photo.src} alt="" decoding="async" onLoad={() => setPhase('focus')} onError={() => { failed.current.add(sample.index); advance(); }}/></div>
   {photo.logo && <span className="map-photo-builder" style={{ backgroundColor: photo.logoBackground }}><img src={photo.logo} alt={`${photo.builder} logo`}/></span>}
   {photo.houseType && <span className="map-photo-house-type">{photo.houseType}<span aria-hidden="true"> ↗</span></span>}
   </a>
  </figure>
 </div>;
}
