'use client';
import {MultiSelectFilter} from './multi-select-filter';
import {matchesSelection,matchesAnySelection} from './filter-selection';
import {DirectoryFilters} from './directory-filters';
import { homeTypeName, plotDetails } from '../reports/home-display';
import { type ReactNode, type ComponentProps, type CSSProperties, useEffect, useRef, useState } from 'react';
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

const galleryMotions = ['results-ken-burns', 'results-zoom-out', 'results-pan-ne', 'results-pan-sw', 'results-pan-nw', 'results-pan-se'];
function AnimatedGalleryImage({ style, ...props }: ComponentProps<'img'>) {
 const [motion, setMotion] = useState(galleryMotions[0]);
 useEffect(() => { setMotion(galleryMotions[Math.floor(Math.random() * galleryMotions.length)]); }, []);
 return <img {...props} style={{ ...style, '--gallery-motion': motion } as CSSProperties}/>;
}

export function Gallery({
 collections,
 favouritesOnly = false,
 includeUnclassified = false,
 introduction,
 featured = false,
 overviewOnly = false,
 places,
 initialImage,
}: {
 collections: Collection[];
 initialImage?: string;
 favouritesOnly?: boolean;
 includeUnclassified?: boolean;
 featured?: boolean;
 overviewOnly?: boolean;
 places?: Record<string,string[]>;
 introduction?: { title: ReactNode; description: string; eyebrow: ReactNode; back?: { href: string; label: string }; map?:ReactNode;details?:ReactNode;counts?:Record<string,number> };
}) {
 const [view, changeView] = useCardView('showhome-gallery-view', 'large');
 const [favourites, setFavourites] = useState<string[]>([]);
 const [ready, setReady] = useState(false);
 const [filters,setFilters]=useUrlFilters(galleryDefaults);
 const {q:query,development,category:mainCategory,room:subCategory}=filters;
 const setQuery=(value:string)=>setFilters(previous=>({...previous,q:value}));
 const setDevelopment=(value:string)=>setFilters(previous=>({...previous,development:value}));
 const setMainCategory=(value:string)=>setFilters(previous=>({...previous,category:value}));
 const setSubCategory=(value:string)=>setFilters(previous=>({...previous,room:value}));
 const [selected, setSelected] = useState<string | null>(null);
 const openedInitialImage = useRef<string | null>(null);
 const dialog = useRef<HTMLDialogElement>(null);
 const hero = useRef<HTMLDivElement>(null);
 const [pageHidden, setPageHidden] = useState(false);
 const [heroInteracting, setHeroInteracting] = useState(false);
 const [heroTimerVersion, setHeroTimerVersion] = useState(0);
 function restartHeroProgress() {
  setHeroInteracting(false);
  setHeroTimerVersion(version => version + 1);
 }
 useEffect(() => {
  const read = () => setPageHidden(document.hidden);
  read();
  document.addEventListener('visibilitychange', read);
  return () => document.removeEventListener('visibilitychange', read);
 }, []);
 const thumbnails = useRef<HTMLDivElement>(null);
 const returnFocus = useRef<HTMLElement | null>(null);
 const [heroId, setHeroId] = useState<string | null>(introduction?.map?'builder-map':null);
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
  if (image.categorisation && !image.categorisation.isRoom && image.categorisation.mainCategory !== 'Exterior') return false;
  const isUncategorised = !image.categorisation || image.categorisation.mainCategory === 'Other';
  if (isUncategorised && !isRoomImage(image)) return false;
  return image.verdict?.matches || includeUnclassified;
 });

 const homeMatches=(image:(typeof available)[number],home:(typeof available)[number]['homes'][number],f:typeof filters)=>matchesSelection(f.bedrooms,String(home.bedrooms))&&matchesSelection(f.site,home.development)&&matchesSelection(f.development,home.developmentUrl)&&matchesAnySelection(f.location,places?.[`${image.slug}:${home.developmentUrl}`]??[]);
 const matches=(image:(typeof available)[number],f:typeof filters)=>{
  if(!matchesSelection(f.developer,image.developer))return false;
  if((f.bedrooms||f.location||f.site||f.development)&&!image.homes.some(home=>homeMatches(image,home,f)))return false;
  if (favouritesOnly && !favourites.includes(image.id)) return false;
  if (!favouritesOnly && !image.verdict?.matches && !includeUnclassified) return false;
  if(!matchesSelection(f.category,image.categorisation?.mainCategory??''))return false;
  if(!matchesSelection(f.room,image.categorisation?.subCategory??''))return false;

  if (f.q) {
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

   if (!searchCorpus.includes(f.q.toLowerCase())) return false;
  }

  return true;
 };
 const images=available.filter(image=>matches(image,filters));
 const facet=(key:keyof typeof filters)=>available.filter(image=>matches(image,{...filters,[key]:''}));
 const mainCategories=[...new Set(facet('category').map(i=>i.categorisation?.mainCategory).filter((v):v is string=>Boolean(v)))].sort();
 const subCategories=[...new Set(facet('room').map(i=>i.categorisation?.subCategory).filter((v):v is string=>Boolean(v)))].sort();
 const facetHomes=(key:keyof typeof filters)=>facet(key).flatMap(image=>image.homes.filter(home=>homeMatches(image,home,{...filters,[key]:''})).map(home=>({home,slug:image.slug})));
 const sites=[...new Map(facetHomes('development').map(({home})=>[home.developmentUrl,home.development])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
 const builderOptions=[...new Set(facet('developer').map(i=>i.developer))].sort();
 const bedroomOptions=[...new Set(facetHomes('bedrooms').map(({home})=>home.bedrooms).filter((n):n is number=>n!==null))].sort((a,b)=>a-b);
 const areaOptions=[...new Set(facetHomes('location').flatMap(({home,slug})=>places?.[`${slug}:${home.developmentUrl}`]??[]))].sort();
 const siteOptions=[...new Set(facetHomes('site').map(({home})=>home.development))].sort();

 const current = images.find(i => i.uid === selected);
 const heroImages = images;
 const heroImage = heroImages.find(i => i.uid === heroId) ?? heroImages[0];
 function heroStep(direction: number) {
  const slides=[...(introduction?.map?['builder-map']:[]),...heroImages.map(i=>i.uid)];
  const index=slides.indexOf(heroId??heroImage?.uid??'');
  setHeroId(slides[(index+direction+slides.length)%slides.length]??null);
 }
 useEffect(() => {
  if (selected && !current) { dialog.current?.close(); setSelected(null); }
 }, [selected, current]);

 function open(uid: string) {
  returnFocus.current = document.activeElement as HTMLElement;
  setSelected(uid);
  showControls();
  dialog.current?.showModal();
 }

 useEffect(() => {
  if (!ready || !initialImage || openedInitialImage.current === initialImage) return;
  openedInitialImage.current = initialImage;
  if (images.some(image => image.uid === initialImage)) {
   setHeroId(initialImage);
   open(initialImage);
  }
 }, [ready, initialImage, images.map(image => image.uid).join('|')]);

 function step(direction: number) {
  showControls();
  const index = images.findIndex(i => i.uid === selected);
  setSelected(images[(index + direction + images.length) % images.length]?.uid ?? null);
 }

 return (
  <section aria-label="Image collection" className={featured ? 'featured-gallery' : undefined}>
   {introduction && <>
    <section className={`results-hero${introduction.details?' builder-results-hero':''}`}>
     {introduction.details&&introduction.back&&<Link className="results-back builder-results-back" href={introduction.back.href}>{introduction.back.label}</Link>}
     <div className="results-hero-copy">
      {!introduction.details&&introduction.back && <Link className="results-back" href={introduction.back.href}>{introduction.back.label}</Link>}
      {introduction.eyebrow&&<p className="eyebrow">{introduction.eyebrow}</p>}
      <h1>{introduction.title}</h1>
      <p>{introduction.description}</p>
      {!introduction.details&&<a className="results-cta" href="#collection">Discover the collection ↓</a>}
     </div>
     {introduction.details&&<div className="builder-results-details">{introduction.details}</div>}
     {(heroImage||introduction.map) && <div ref={hero} className={`results-hero-photo${selected || pageHidden || heroInteracting ? ' is-paused' : ''}${heroInteracting?' is-interacting':''}`} onMouseEnter={() => setHeroInteracting(true)} onMouseLeave={restartHeroProgress} onFocus={() => setHeroInteracting(true)} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) restartHeroProgress();
     }} role="region" aria-label="Builder developments and image carousel" onKeyDown={e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); heroStep(e.key === 'ArrowLeft' ? -1 : 1); }
     }}>
      {heroId==='builder-map'&&introduction.map?<div className="builder-hero-map">{introduction.map}</div>:heroImage?<><button className="results-hero-image" onClick={() => open(heroImage.uid)} aria-label="Open current image fullscreen"><AnimatedGalleryImage key={heroImage.uid} src={imageUrl(heroImage.slug, heroImage.path)} alt={heroImage.verdict?.description ?? 'Showhome interior'}/></button>
      </>:null}
      <div key={`${heroId==='builder-map'?'builder-map':heroImage?.uid}:${heroTimerVersion}`} className="results-hero-room-type">
       {heroId==='builder-map'?'Developments':heroImage?.categorisation?.subCategory??heroImage?.categorisation?.mainCategory??'Showhome interior'}
      </div>
      {heroImages.length+(introduction.map?1:0)>1&&<div className="results-slide-progress" aria-hidden="true"><span key={`${heroId==='builder-map'?'builder-map':heroImage?.uid}:${heroTimerVersion}`} onAnimationEnd={()=>heroStep(1)}/></div>}
      <button className="results-arrow results-prev" onClick={() => heroStep(-1)} aria-label="Previous preview image">‹</button>
      <button className="results-arrow results-next" onClick={() => heroStep(1)} aria-label="Next preview image">›</button>
     </div>}
     {introduction.details&&introduction.counts&&<div className="results-stats builder-results-stats">{Object.entries(introduction.counts).map(([label,count])=><div key={label}><strong>{count.toLocaleString('en-GB')}</strong><span>{label}</span></div>)}</div>}
    </section>
    {!introduction.details&&<div className="results-stats">
     {introduction.counts?Object.entries(introduction.counts).map(([label,count])=><div key={label}><strong>{count.toLocaleString('en-GB')}</strong><span>{label}</span></div>):<><div><strong>{favouritesOnly && !ready ? '…' : available.length}</strong><span>Unique images</span></div>
     <div><strong>{sites.length}</strong><span>Developments</span></div>
     <div><strong>{new Set(available.flatMap(i => i.homes.map(h => `${i.slug}:${h.url}`))).size}</strong><span>Properties</span></div></>}
    </div>}
    {!overviewOnly&&<div className="results-heading" id="collection"><h2>{favouritesOnly ? 'Your saved spaces' : 'Explore the collection'}</h2></div>}
   </>}
   {!overviewOnly&&<>
   {!featured && <><DirectoryFilters className="filters">
    <label>
     Search
     <input
      value={query}
      onChange={e => setQuery(e.target.value)}
      placeholder="Room, furniture, colour, style…"
     />
    </label>
    <MultiSelectFilter label="Builders" value={filters.developer} options={builderOptions} onChange={value=>setFilters(previous=>({...previous,developer:value}))}/>
    <MultiSelectFilter label="Interior types" value={mainCategory} options={mainCategories} onChange={setMainCategory}/>
    <MultiSelectFilter label="Room types" value={subCategory} options={subCategories} onChange={setSubCategory}/>
    <MultiSelectFilter label="Developments" value={development} options={sites.map(([value,label])=>({value,label}))} onChange={setDevelopment}/>
    {places&&<>
     <MultiSelectFilter label="Bedrooms" value={filters.bedrooms} options={bedroomOptions.map(n=>({value:String(n),label:`${n} bedrooms`}))} onChange={value=>setFilters(previous=>({...previous,bedrooms:value}))}/>
     <MultiSelectFilter label="Areas" value={filters.location} options={areaOptions} onChange={value=>setFilters(previous=>({...previous,location:value}))}/>
     <MultiSelectFilter label="Developments" value={filters.site} options={siteOptions} onChange={value=>setFilters(previous=>({...previous,site:value}))}/>
    </>}
    <button className="results-reset" onClick={() => setFilters(galleryDefaults)}>Clear filters</button>
   </DirectoryFilters>

   <div className="directory-toolbar" style={{ marginTop: 24 }}>
    <ViewOptions view={view} onChange={changeView} ariaLabel="Image card layout" />
    <p className="count" style={{ margin: 0 }}>
     {favouritesOnly && !ready
      ? 'Loading favourites…'
      : `${images.length} ${images.length === 1 ? 'image' : 'images'}`}
    </p>
   </div>

   </>}
   <div className={featured ? 'image-grid home-featured-grid' : `image-grid image-grid-${view}`}>
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
       {featured ? <><h3>{image.categorisation?.mainCategory ?? 'Showhome interior'}</h3><p className="subtle">{image.developer}</p></> : <>
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
       </>}
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

   </>}

   <dialog
    ref={dialog}
    className={`viewer results-viewer ${controlsVisible ? 'controls-visible' : ''}`}
    aria-label="Fullscreen interior gallery"
    onClose={() => {
     setSelected(null);
     const url = new URL(window.location.href);
     if (url.searchParams.has('image')) {
      url.searchParams.delete('image');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
     }
     returnFocus.current?.focus();
    }}
    onPointerMove={showControls} onPointerDown={showControls} onFocus={showControls}
    onKeyDown={e => {
     showControls();
     if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); }
    }}
   >
    {current && <>
     <AnimatedGalleryImage key={current.uid} className="results-full-image" style={{ touchAction: 'pan-y pinch-zoom' }}
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
