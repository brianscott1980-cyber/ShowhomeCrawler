'use client';
import {optimizedImageSource} from './optimized-image-source';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { projectLocation } from './coverage-map';
import { choosePhotoPosition } from './map-photo-position';
import type { CoveragePoint, HomePhoto } from './homepage-data';

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

export function MapPhotoSamples({ photos, points, onActiveSitesChange }: { photos: HomePhoto[]; points: CoveragePoint[]; onActiveSitesChange?: (siteIds: string[]) => void }) {
 const [sample, setSample] = useState<{ index: number; position: number; motion: number; cycle: number } | null>(null);
 const overlayRef = useRef<HTMLDivElement>(null);
 const frameRef = useRef<HTMLElement>(null);
 const [placement, setPlacement] = useState<{ left: number; top: number }>();
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
  const builder = sample ? photos[sample.index]?.builder : undefined;
  onActiveSitesChange?.(focused && builder ? points.filter(point => point.builder === builder).map(point => point.siteId ?? `${point.builder}:${point.name}`) : []);
 }, [phase, sample, photos, points, onActiveSitesChange]);
 useEffect(() => {
  if (phase === 'loading' || paused || reducedMotion || (interacting && phase === 'hold')) return;
  const step = sampleSequence[phase];
  const timer = window.setTimeout(() => phase === 'restore' ? advance() : setPhase(step.next), step.duration);
  return () => window.clearTimeout(timer);
 }, [phase, paused, reducedMotion, interacting, advance]);
 useEffect(() => {
  const overlay = overlayRef.current;
  const frame = frameRef.current;
  const svg = overlay?.closest('.home-hero-map')?.querySelector('svg');
  if (!overlay || !frame || !svg || !sample) return;
  const place = () => {
   const matrix = svg.getScreenCTM();
   if (!matrix) return;
   const bounds = overlay.getBoundingClientRect();
   const builder = photos[sample.index]?.builder;
   const dots = points.map(point => {
    const projected = projectLocation(point);
    const screen = new DOMPoint(projected.x, projected.y).matrixTransform(matrix);
    return { x: screen.x - bounds.left, y: screen.y - bounds.top, related: point.builder === builder };
   });
   setPlacement(choosePhotoPosition(bounds.width, bounds.height, frame.offsetWidth, frame.offsetHeight, dots));
  };
  place();
  const observer = new ResizeObserver(place);
  observer.observe(overlay); observer.observe(frame); observer.observe(svg);
  return () => observer.disconnect();
 }, [sample, photos, points]);
 if (!sample) return null;
 const photo = photos[sample.index];
 if (!photo) return null;
 const visible = phase === 'enter' || phase === 'hold' || (reducedMotion && phase === 'focus');
 return <div ref={overlayRef} className="map-photo-samples">
  <figure ref={frameRef} style={placement ? { ...placement, right: 'auto' } : undefined} key={sample.cycle} data-phase={phase} className={`map-photo-sample map-photo-position-${sample.position} map-photo-motion-${sample.motion}${visible ? ' is-visible' : ''}${interacting ? ' is-interacting' : ''}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
   <a className="map-photo-link" href={photo.houseTypeHref} tabIndex={visible ? 0 : -1} aria-label={`Explore ${photo.houseType ?? photo.builder} interiors`}>
   <div className="map-photo-window"><Image src={optimizedImageSource(photo.src)} alt="" width={480} height={360} sizes="(max-width: 700px) 62vw, 372px" loading="eager" fetchPriority="low" onLoad={() => setPhase('focus')} onError={() => { failed.current.add(sample.index); advance(); }}/></div>
   {photo.logo && <span className="map-photo-builder" style={{ backgroundColor: photo.logoBackground }}><img src={photo.logo} alt={`${photo.builder} logo`}/></span>}
   {photo.houseType && <span className="map-photo-house-type">{photo.houseType}<span aria-hidden="true"> ↗</span></span>}
   </a>
  </figure>
 </div>;
}
