'use client';
import {homeTypeName,plotDetails} from '../reports/home-display';
import { useEffect, useRef, useState } from 'react';
import type { RunReport } from '../reports/report';

interface Collection { slug: string; name: string; report: RunReport }
const key = 'showhome-favourites-v1';
const imageUrl = (slug: string, path: string) => `/api/assets/${slug}/${path.split('/').map(encodeURIComponent).join('/')}`;
export function Gallery({ collections, favouritesOnly = false, includeUnclassified = false }: { collections: Collection[]; favouritesOnly?: boolean; includeUnclassified?: boolean }) {
 const [favourites, setFavourites] = useState<string[]>([]);
 const [ready, setReady] = useState(false);
 const [query, setQuery] = useState('');
 const [development, setDevelopment] = useState('');
 const [selected, setSelected] = useState<string | null>(null);
 const dialog = useRef<HTMLDialogElement>(null);
 const swipe = useRef<{id:number;x:number;y:number}|null>(null);
 useEffect(() => {
  const read = () => { try { const stored: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); setFavourites(Array.isArray(stored) ? stored.filter((v): v is string => typeof v === 'string') : []); } catch { setFavourites([]); } setReady(true); };
  read(); window.addEventListener('storage', read); return () => window.removeEventListener('storage', read);
 }, []);
 function toggle(id: string) {
  const next = favourites.includes(id) ? favourites.filter(v => v !== id) : [...favourites, id];
  setFavourites(next); try { localStorage.setItem(key, JSON.stringify(next)); window.dispatchEvent(new Event('showhome-favourites-changed')); } catch { /* Saving may be unavailable in private browser storage. */ }
 }
 const all = collections.flatMap(c => c.report.images.map(image => ({ ...image, slug: c.slug, developer: c.name, homes: c.report.properties.filter(p => p.imageIds.includes(image.id)), uid: `${c.slug}:${image.id}` })));
 const available = all.filter(image => (image.verdict?.matches || (includeUnclassified && !image.verdict)) && (!favouritesOnly || favourites.includes(image.id)));
 const images = available.filter(image => {
  if (favouritesOnly && (!image.verdict?.matches || !favourites.includes(image.id))) return false;
  if (!image.verdict?.matches && !(includeUnclassified && !image.verdict)) return false;
  if (development && !image.homes.some(h => h.developmentUrl === development)) return false;
  return `${image.developer} ${image.verdict?.description ?? ''} ${image.homes.map(h => `${h.name} ${h.development}`).join(' ')}`.toLowerCase().includes(query.toLowerCase());
 });
 const sites = [...new Map(available.flatMap(image => image.homes.map(p => [p.developmentUrl, p.development] as const))).entries()].sort((a, b) => a[1].localeCompare(b[1]));
 useEffect(() => { if (development && !sites.some(([url]) => url === development)) setDevelopment(''); }, [development, sites]);
 const current = images.find(i => i.uid === selected);
 function open(uid: string) { setSelected(uid); dialog.current?.showModal(); }
 function step(direction: number) { const index = images.findIndex(i => i.uid === selected); setSelected(images[(index + direction + images.length) % images.length]?.uid ?? null); }
 return <section aria-label="Image collection"><div className="filters"><label>Search<input value={query} onChange={e => setQuery(e.target.value)} placeholder="House style, location or room…"/></label><label>Development<select value={development} onChange={e => setDevelopment(e.target.value)}><option value="">All developments</option>{sites.map(([url, name]) => <option key={url} value={url}>{name}</option>)}</select></label></div><p className="count">{favouritesOnly && !ready ? 'Loading favourites…' : `${images.length} ${images.length === 1 ? 'image' : 'images'}`}</p><div className="image-grid">{images.map(image => <article className="image-card" key={image.uid}><button className="photo-button" onClick={() => open(image.uid)} aria-label={`Enlarge ${image.verdict?.description ?? 'gallery image'}`}><img loading="lazy" src={imageUrl(image.slug, image.path)} alt={image.verdict?.description ?? 'Showhome interior'}/><span>View image ↗</span></button><div className="image-body"><div className="image-heading"><p className="eyebrow">{image.developer}</p><button className={`save ${favourites.includes(image.id) ? 'saved' : ''}`} onClick={() => toggle(image.id)} aria-pressed={favourites.includes(image.id)} aria-label={favourites.includes(image.id) ? 'Remove from favourites' : 'Add to favourites'}>{favourites.includes(image.id) ? '♥' : '♡'}</button></div><h3>{[...new Set(image.homes.map(home => homeTypeName(home.name)))].join(' · ')}</h3><p className="subtle">{image.verdict?.description ?? 'Showhome interior'}</p><details><summary>Explore this home</summary>{image.homes.map((home, index) => <div className="property" key={`${home.url}:${index}`}><a href={home.url} target="_blank" rel="noreferrer">{homeTypeName(home.name)} ↗</a><span>{home.development} · {home.bedrooms} beds{home.price !== null ? ` · £${home.price.toLocaleString('en-GB')}` : ''}</span><span>{plotDetails(home)}</span></div>)}</details></div></article>)}</div>{!images.length && ready && <div className="empty">{favouritesOnly ? 'No saved spaces match. Add favourites using the heart on a developer’s images.' : 'No spaces found. Try another search or development.'}</div>}<dialog ref={dialog} className="viewer" onClose={() => setSelected(null)} onKeyDown={e => { if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); }}>{current && <><div className="viewer-toolbar"><span>{current.developer}</span><button onClick={() => toggle(current.id)} aria-label="Toggle favourite">{favourites.includes(current.id) ? '♥ Saved' : '♡ Save'}</button><button onClick={() => dialog.current?.close()} autoFocus aria-label="Close image">Close ×</button></div><img style={{touchAction:'pan-y pinch-zoom'}} onTouchStart={e => {const touch=e.touches[0];swipe.current=e.touches.length===1&&touch?{id:touch.identifier,x:touch.clientX,y:touch.clientY}:null;}} onTouchCancel={() => {swipe.current=null;}} onTouchEnd={e => {const start=swipe.current;swipe.current=null;if(!start||e.touches.length)return;const touch=Array.from(e.changedTouches).find(t=>t.identifier===start.id);if(!touch)return;const dx=touch.clientX-start.x,dy=touch.clientY-start.y;if(Math.abs(dx)>=48&&Math.abs(dx)>=Math.abs(dy)*1.3)step(dx<0?1:-1);}} src={imageUrl(current.slug, current.path)} alt={current.verdict?.description ?? 'Showhome image'}/><div className="viewer-bottom"><button onClick={() => step(-1)} aria-label="Previous image">←</button><p>{current.verdict?.description}</p><button onClick={() => step(1)} aria-label="Next image">→</button></div></>}{!current && <button onClick={() => dialog.current?.close()}>Close ×</button>}</dialog></section>;
}
