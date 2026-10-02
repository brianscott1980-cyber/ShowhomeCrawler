'use client';
import { homeTypeName, plotDetails } from '../reports/home-display';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { RunReport } from '../reports/report';
import { ViewOptions, useCardView } from './view-options';
import { isRoomImage } from '../vision/room-classifier';
import Link from 'next/link';
import {useUrlFilters} from './url-filters';
const galleryDefaults={q:'',development:'',category:'',room:'',developer:'',bedrooms:'',location:'',site:''};
import { heartIcon } from '../reports/gallery-ui';

interface Collection { slug: string; name: string; report: RunReport }
const key = 'showhome-favourites-v1';
const imageUrl = (slug: string, path: string) => `/api/assets/${slug}/${path.split('/').map(encodeURIComponent).join('/')}`;

export function Gallery({
 collections,
 favouritesOnly = false,
 includeUnclassified = false,
 introduction,
 places,
}: {
 collections: Collection[];
 favouritesOnly?: boolean;
 includeUnclassified?: boolean;
 places?: Record<string,string[]>;
 introduction?: { title: ReactNode; description: string; eyebrow: ReactNode; back?: { href: string; label: string } };
}) {
 const [view, changeView] = useCardView('showhome-gallery-view', 'large');
 const [favourites, setFavourites] = useState<string[]>([]);
 const [ready, setReady] = useState(false);
 const [filters,setFilters]=useUrlFilters(galleryDefaults);
 const {q:query,development,category:mainCategory,room:subCategory}=filters;
 const setQuery=(value:string)=>setFilters(previous=>({...previous,q:value}));
 const setDevelopment=(value:string)=>setFilters(previous=>({...previous,development:value}));
 const setMainCategory=(value:string)=>setFilters(previous=>({...previous,category:value,room:''}));
 const setSubCategory=(value:string)=>setFilters(previous=>({...previous,room:value}));
 const [selected, setSelected] = useState<string | null>(null);
 const dialog = useRef<HTMLDialogElement>(null);
 const hero = useRef<HTMLDivElement>(null);
 const thumbnails = useRef<HTMLDivElement>(null);
 const returnFocus = useRef<HTMLElement | null>(null);
 const [heroId, setHeroId] = useState<string | null>(null);
 const [controlsVisible, setControlsVisible] = useState(true);
 const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
 function showControls() {
  setControlsVisible(true);
  if (idleTimer.current) clearTimeout(idleTimer.current);
  idleTimer.current = setTimeout(() => setControlsVisible(false), 1800);
 }
 useEffect(() => () => { if (idleTimer.current) clearTimeout(idleTimer.current); }, []);
 useEffect(() => {
  if (!selected) return;
  const overflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  return () => { document.body.style.overflow = overflow; };
 }, [selected]);
 useEffect(() => {
  const strip = thumbnails.current;
  const active = strip?.querySelector<HTMLElement>('[aria-current="true"]');
  if (strip && active) strip.scrollTo?.({ left: active.offsetLeft - (strip.clientWidth - active.clientWidth) / 2, behavior: 'smooth' });
 }, [selected]);
 const swipe = useRef<{ id: number; x: number; y: number } | null>(null);

 useEffect(() => {
  const read = () => {
   try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    setFavourites(Array.isArray(stored) ? stored.filter((v): v is string => typeof v === 'string') : []);
   } catch {
    setFavourites([]);
   }
   setReady(true);
  };
  read();
  window.addEventListener('storage', read);
  return () => window.removeEventListener('storage', read);
 }, []);

 function toggle(id: string) {
  const next = favourites.includes(id) ? favourites.filter(v => v !== id) : [...favourites, id];
  setFavourites(next);
  try {
   localStorage.setItem(key, JSON.stringify(next));
   window.dispatchEvent(new Event('showhome-favourites-changed'));
  } catch {
   /* Saving may be unavailable in private browser storage. */
  }
 }

 const all = collections.flatMap(c =>
  c.report.images.map(image => ({
   ...image,
   slug: c.slug,
   developer: c.name,
   homes: c.report.properties.filter(p => p.imageIds.includes(image.id)),
   uid: `${c.slug}:${image.id}`,
  }))
 );

 const available = all.filter(image => {
  if (favouritesOnly) return favourites.includes(image.id);
  const isUncategorised = !image.categorisation || image.categorisation.mainCategory === 'Other';
  if (isUncategorised && !isRoomImage(image)) return false;
  return image.verdict?.matches || includeUnclassified;
 });

 const mainCategories = [...new Set(available.map(img => img.categorisation?.mainCategory).filter(Boolean) as string[])].sort();

 const subCategories = [...new Set(
  available
   .filter(img => !mainCategory || img.categorisation?.mainCategory === mainCategory)
   .map(img => img.categorisation?.subCategory)
   .filter(Boolean) as string[]
 )].sort();

 const sites = [...new Map(available.flatMap(image => image.homes.map(p => [p.developmentUrl, p.development] as const))).entries()].sort((a, b) => a[1].localeCompare(b[1]));

 useEffect(() => {
  if (development && !sites.some(([url]) => url === development)) setDevelopment('');
 }, [development, sites]);

 useEffect(() => {
  if (subCategory && !subCategories.includes(subCategory)) setSubCategory('');
 }, [subCategory, subCategories]);

 const images = available.filter(image => {
  if (filters.developer && image.developer !== filters.developer) return false;
  if ((filters.bedrooms || filters.location || filters.site) && !image.homes.some(home =>
   (!filters.bedrooms || home.bedrooms === Number(filters.bedrooms)) &&
   (!filters.site || home.development === filters.site) &&
   (!filters.location || places?.[`${image.slug}:${home.developmentUrl}`]?.includes(filters.location))
  )) return false;
  if (favouritesOnly && !favourites.includes(image.id)) return false;
  if (!favouritesOnly && !image.verdict?.matches && !includeUnclassified) return false;
  if (mainCategory && image.categorisation?.mainCategory !== mainCategory) return false;
  if (subCategory && image.categorisation?.subCategory !== subCategory) return false;
  if (development && !image.homes.some(h => h.developmentUrl === development)) return false;

  if (query) {
   const cat = image.categorisation;
   const searchCorpus = [
    image.developer,
    image.verdict?.description ?? '',
    image.verdict?.reason ?? '',
    cat?.mainCategory ?? '',
    cat?.subCategory ?? '',
    ...(cat?.objects ?? []),
    ...(cat?.colours ?? []),
    ...(cat?.chairs ?? []),
    cat?.wallpaper ?? '',
    cat?.curtains ?? '',
    cat?.hasTelevision ? 'television tv' : '',
    cat?.hasComputer ? 'computer pc monitor desk laptop' : '',
    ...image.homes.map(h => `${h.name} ${h.development}`),
   ].join(' ').toLowerCase();

   if (!searchCorpus.includes(query.toLowerCase())) return false;
  }

  return true;
 });

 const current = images.find(i => i.uid === selected);
 const heroImages = images;
 const heroImage = heroImages.find(i => i.uid === heroId) ?? heroImages[0];
 function heroStep(direction: number) {
  const index = heroImages.findIndex(i => i.uid === heroImage?.uid);
  setHeroId(heroImages[(index + direction + heroImages.length) % heroImages.length]?.uid ?? null);
 }
 useEffect(() => {
  if (!introduction || heroImages.length < 2) return;
  const timer = setInterval(() => {
   if (dialog.current?.open || document.hidden || hero.current?.matches(':hover') || hero.current?.contains(document.activeElement) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
   setHeroId(previous => {
    const index = heroImages.findIndex(i => i.uid === previous);
    return heroImages[(index + 1 + heroImages.length) % heroImages.length]?.uid ?? null;
   });
  }, 5000);
  return () => clearInterval(timer);
 }, [introduction, heroImages.map(i => i.uid).join(':')]);
 useEffect(() => {
  if (selected && !current) { dialog.current?.close(); setSelected(null); }
 }, [selected, current]);

 function open(uid: string) {
  returnFocus.current = document.activeElement as HTMLElement;
  setSelected(uid);
  showControls();
  dialog.current?.showModal();
 }

 function step(direction: number) {
  showControls();
  const index = images.findIndex(i => i.uid === selected);
  setSelected(images[(index + direction + images.length) % images.length]?.uid ?? null);
 }

 return (
  <section aria-label="Image collection">
   {introduction && <>
    <section className="results-hero">
     <div className="results-hero-copy">
      {introduction.back && <Link className="results-back" href={introduction.back.href}>{introduction.back.label}</Link>}
      <p className="eyebrow">{introduction.eyebrow}</p>
      <h1>{introduction.title}</h1>
      <p>{introduction.description}</p>
      <a className="results-cta" href="#collection">Discover the collection ↓</a>
     </div>
     {heroImage && <div ref={hero} className="results-hero-photo" role="region" aria-label="Interior image carousel" onKeyDown={e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); heroStep(e.key === 'ArrowLeft' ? -1 : 1); }
     }}>
      <button className="results-hero-image" onClick={() => open(heroImage.uid)} aria-label="Open current image fullscreen"><img src={imageUrl(heroImage.slug, heroImage.path)} alt={heroImage.verdict?.description ?? 'Showhome interior'}/></button>
      <button className="results-arrow results-prev" onClick={() => heroStep(-1)} aria-label="Previous preview image">‹</button>
      <button className="results-arrow results-next" onClick={() => heroStep(1)} aria-label="Next preview image">›</button>
     </div>}
    </section>
    <div className="results-stats">
     <div><strong>{favouritesOnly && !ready ? '…' : available.length}</strong><span>Unique images</span></div>
     <div><strong>{sites.length}</strong><span>Developments</span></div>
     <div><strong>{new Set(available.flatMap(i => i.homes.map(h => `${i.slug}:${h.url}`))).size}</strong><span>Properties</span></div>
    </div>
    <div className="results-heading" id="collection"><h2>{favouritesOnly ? 'Your saved spaces' : 'Explore the collection'}</h2></div>
   </>}
   <div className="filters">
    <label>
     Search
     <input
      value={query}
      onChange={e => setQuery(e.target.value)}
      placeholder="Room, furniture, colour, style…"
     />
    </label>
    {mainCategories.length > 1 && (
     <label>
      Interior type
      <select
       value={mainCategory}
       onChange={e => {
        setMainCategory(e.target.value);
       }}
      >
       <option value="">All interiors ({mainCategories.length})</option>
       {mainCategories.map(cat => (
        <option key={cat} value={cat}>{cat}</option>
       ))}
      </select>
     </label>
    )}
    {subCategories.length > 1 && (
     <label>
      Room type
      <select
       value={subCategory}
       onChange={e => setSubCategory(e.target.value)}
      >
       <option value="">All room types ({subCategories.length})</option>
       {subCategories.map(sub => (
        <option key={sub} value={sub}>{sub}</option>
       ))}
      </select>
     </label>
    )}
    <label>
     Development
     <select value={development} onChange={e => setDevelopment(e.target.value)}>
      <option value="">All developments</option>
      {sites.map(([url, name]) => (
       <option key={url} value={url}>{name}</option>
      ))}
     </select>
    </label>
    {places && <>
     <label>Bedrooms<select value={filters.bedrooms} onChange={e=>setFilters({...filters,bedrooms:e.target.value})}><option value="">All bedrooms</option>{[...new Set(available.flatMap(i=>i.homes.map(h=>h.bedrooms)).filter((n):n is number=>n!==null))].sort((a,b)=>a-b).map(n=><option key={n} value={n}>{n} bedrooms</option>)}</select></label>
     <label>Location<select value={filters.location} onChange={e=>setFilters({...filters,location:e.target.value})}><option value="">All locations</option>{[...new Set(Object.values(places).flat())].sort().map(name=><option key={name}>{name}</option>)}</select></label>
     <label>Site<select value={filters.site} onChange={e=>setFilters({...filters,site:e.target.value})}><option value="">All sites</option>{[...new Set(available.flatMap(i=>i.homes.map(h=>h.development)))].sort().map(name=><option key={name}>{name}</option>)}</select></label>
    </>}
    <button className="results-reset" onClick={() => setFilters(galleryDefaults)}>Clear filters</button>
   </div>

   <div className="directory-toolbar" style={{ marginTop: 24 }}>
    <ViewOptions view={view} onChange={changeView} ariaLabel="Image card layout" />
    <p className="count" style={{ margin: 0 }}>
     {favouritesOnly && !ready
      ? 'Loading favourites…'
      : `${images.length} ${images.length === 1 ? 'image' : 'images'}`}
    </p>
   </div>

   <div className={`image-grid image-grid-${view}`}>
    {images.map(image => (
     <article className="image-card" key={image.uid}>
      <div className="results-photo-frame">
      <button
       className="photo-button"
       onClick={() => open(image.uid)}
       aria-label={`Enlarge ${image.verdict?.description ?? 'gallery image'}`}
      >
       <img
        loading="lazy"
        src={imageUrl(image.slug, image.path)}
        alt={image.verdict?.description ?? 'Showhome interior'}
       />
       <span>{image.categorisation?.subCategory ?? 'Showhome interior'}</span>
      </button>
      <button className="results-save" onClick={() => toggle(image.id)} aria-pressed={favourites.includes(image.id)} aria-label={favourites.includes(image.id) ? 'Remove from favourites' : 'Add to favourites'} dangerouslySetInnerHTML={{ __html: heartIcon }}/>
      </div>

      <div className="image-body">
       <div className="image-heading">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
         <p className="eyebrow" style={{ margin: 0 }}>{image.developer}</p>
         {image.categorisation?.subCategory && (
          <span className="badge-pill">{image.categorisation.subCategory}</span>
         )}
        </div>
       </div>

       <h3>{[...new Set(image.homes.map(home => homeTypeName(home.name)))].join(' · ') || image.developer}</h3>
       <p className="subtle">{image.verdict?.description ?? 'Showhome interior'}</p>

       {image.categorisation && (
        <div className="feature-tags">
         {image.categorisation.colours.slice(0, 3).map(c => (
          <span key={c} className="tag tag-colour">{c}</span>
         ))}
         {image.categorisation.hasTelevision && (
          <span className="tag tag-tech" title="Television present">📺 TV</span>
         )}
         {image.categorisation.hasComputer && (
          <span className="tag tag-tech" title="Computer / Workspace present">💻 PC</span>
         )}
         {image.categorisation.wallpaper && (
          <span className="tag tag-decor">{image.categorisation.wallpaper}</span>
         )}
         {image.categorisation.curtains && (
          <span className="tag tag-decor">{image.categorisation.curtains}</span>
         )}
        </div>
       )}

       <details>
        <summary>Explore this home</summary>
        {image.homes.map((home, index) => (
         <div className="property" key={`${home.url}:${index}`}>
          <a href={home.url} target="_blank" rel="noreferrer">
           {homeTypeName(home.name)} ↗
          </a>
          <span>
           {home.development} · {home.bedrooms} beds
           {home.price !== null ? ` · £${home.price.toLocaleString('en-GB')}` : ''}
          </span>
          <span>{plotDetails(home)}</span>
         </div>
        ))}
       </details>
      </div>
     </article>
    ))}
   </div>

   {!images.length && ready && (
    <div className="empty">
     {favouritesOnly
      ? 'No saved spaces match. Add favourites using the heart on a developer’s images.'
      : 'No spaces found. Try another search or development.'}
    </div>
   )}

   <dialog
    ref={dialog}
    className={`viewer results-viewer ${controlsVisible ? 'controls-visible' : ''}`}
    aria-label="Fullscreen interior gallery"
    onClose={() => { setSelected(null); returnFocus.current?.focus(); }}
    onPointerMove={showControls} onPointerDown={showControls} onFocus={showControls}
    onKeyDown={e => {
     showControls();
     if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); }
    }}
   >
    {current && <>
     <img className="results-full-image" style={{ touchAction: 'pan-y pinch-zoom' }}
      onTouchStart={e => { const t = e.touches[0]; swipe.current = e.touches.length === 1 && t ? { id: t.identifier, x: t.clientX, y: t.clientY } : null; }}
      onTouchCancel={() => { swipe.current = null; }}
      onTouchEnd={e => {
       const start = swipe.current; swipe.current = null;
       if (!start || e.touches.length) return;
       const t = Array.from(e.changedTouches).find(t => t.identifier === start.id);
       if (!t) return;
       const dx = t.clientX - start.x, dy = t.clientY - start.y;
       if (Math.abs(dx) >= 48 && Math.abs(dx) >= Math.abs(dy) * 1.3) step(dx < 0 ? 1 : -1);
      }} src={imageUrl(current.slug, current.path)} alt={current.verdict?.description ?? 'Showhome interior'}/>
     <div className="results-viewer-header results-viewer-controls">
      <button onClick={() => toggle(current.id)} aria-pressed={favourites.includes(current.id)} aria-label={favourites.includes(current.id) ? 'Remove from favourites' : 'Add to favourites'} dangerouslySetInnerHTML={{ __html: heartIcon }}/>
      <button onClick={() => dialog.current?.close()} autoFocus aria-label="Close image">×</button>
     </div>
     <button className="results-arrow results-prev results-viewer-controls" onClick={() => step(-1)} aria-label="Previous image">‹</button>
     <button className="results-arrow results-next results-viewer-controls" onClick={() => step(1)} aria-label="Next image">›</button>
     <div ref={thumbnails} className="results-thumbnails results-viewer-controls" aria-label="Image thumbnails" onWheel={e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY; }}>
      {images.map((image, index) => <button key={image.uid} aria-label={`View image ${index + 1}`} aria-current={image.uid === selected} onClick={() => { setSelected(image.uid); showControls(); }}>
       <img loading="lazy" src={imageUrl(image.slug, image.path)} alt={image.verdict?.description ?? 'Showhome interior'}/>
      </button>)}
     </div>
    </>}
    {!current && <button onClick={() => dialog.current?.close()}>Close ×</button>}
   </dialog>
  </section>
 );
}
