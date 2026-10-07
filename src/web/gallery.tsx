'use client';
import {colourPattern,interiorTags} from './interior-tags';
import {cascadingFiltersEnabled} from './filter-settings';
import {isCategorisedImage,isInteriorCategory} from './image-classification';
import {sharedImageCards,roomLabel} from './shared-image-cards';
import {useGalleryQuery} from './use-gallery-query';
import type {GalleryScope,GalleryPageData,GalleryImage} from './gallery-page-data';
import {DirectoryQueryStatus} from './use-directory-query';
import {RollingCount} from './rolling-count';
import {SingleSelectFilter} from './single-select-filter';
import {MoneyInput} from './money-input';
import {priceRangeOptions} from './price-range';
import {bedroomRangeOptions} from './bedroom-range';
import {developmentName} from './development-name';
import {CardImage} from './card-image';
import {GalleryCardResults} from './inspiration-row';
import {BreadcrumbBack} from './breadcrumb-back';
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
const galleryDefaults={colour:'',tag:'',building:'',q:'',development:'',category:'',room:'',developer:'',bedrooms:'',location:'',site:'',minBeds:'',maxBeds:'',minPrice:'',maxPrice:''};
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
 galleryScope, galleryPage,
}: {
 collections: Collection[];
 galleryScope?:GalleryScope; galleryPage?:GalleryPageData;
 initialImage?: string;
 favouritesOnly?: boolean;
 includeUnclassified?: boolean;
 featured?: boolean;
 overviewOnly?: boolean;
 places?: Record<string,string[]>;
 introduction?: { title: ReactNode; description: string; eyebrow: ReactNode; titleAccessory?:ReactNode; developmentDetails?:ReactNode; developmentLocation?:ReactNode; back?: { href: string; label: string }; map?:ReactNode;details?:ReactNode;counts?:Record<string,number> };
}) {
 const [view, changeView] = useCardView('showhome-gallery-view', 'large');
 const [favourites, setFavourites] = useState<string[]>([]);
 const [ready, setReady] = useState(false);
 const [filters,setFilters,filtersReady]=useUrlFilters(galleryDefaults);
 const {q:query,development,category:mainCategory,room:subCategory}=filters;
 const setQuery=(value:string)=>setFilters(previous=>({...previous,q:value}));
 const tagSelected=(value:string)=>galleryScope?.kind==='interiors'?matchesSelection(new RegExp(colourPattern,'i').test(value)?filters.colour:filters.tag,value)&&Boolean(new RegExp(colourPattern,'i').test(value)?filters.colour:filters.tag):query===value;
 const resultsStart=useRef<HTMLDivElement>(null);
 const toggleTag=(value:string)=>{
  if(galleryScope?.kind!=='interiors')setQuery(query===value?'':value);
  else{const key=new RegExp(colourPattern,'i').test(value)?'colour':'tag';setFilters(previous=>({...previous,q:'',[key]:previous[key]===value?'':value}));}
  requestAnimationFrame(()=>{
   const target=resultsStart.current;if(!target)return;
   const header=document.querySelector<HTMLElement>('.site-header');
   const filterBar=target.closest('section')?.querySelector<HTMLElement>('.directory-filter-row');
   const offset=(header?.getBoundingClientRect().height??0)+(filterBar?.getBoundingClientRect().height??0)+16;
   window.scrollTo({top:Math.max(0,window.scrollY+target.getBoundingClientRect().top-offset),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  });
 };
 const setDevelopment=(value:string)=>setFilters(previous=>({...previous,development:value}));
 const setMainCategory=(value:string)=>setFilters(previous=>({...previous,category:value}));
 const setSubCategory=(value:string)=>setFilters(previous=>({...previous,room:value}));
 const [selected, setSelected] = useState<string | null>(null);
 const openedInitialImage = useRef<string | null>(null);
 const dialog = useRef<HTMLDialogElement>(null);
 const hero = useRef<HTMLDivElement>(null);
 const [pageHidden, setPageHidden] = useState(false);
 const [heroInteracting, setHeroInteracting] = useState(false);
 const [heroPlaying,setHeroPlaying]=useState(!introduction?.map);
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

 const all:GalleryImage[] = collections.flatMap(c =>
  c.report.images.flatMap(image => {const card={
   ...image,
   slug: c.slug,
   developer: c.name,
   homes: c.report.properties.filter(p => p.imageIds.includes(image.id)),
   uid: `${c.slug}:${image.id}`,
  };return featured?[{...card,imageUid:card.uid}]:sharedImageCards(card);})
 );

 const available = all.filter(image => {
  if (!isCategorisedImage(image)) return false;
  if(galleryScope?.kind==='interiors'&&!isInteriorCategory(image.categorisation?.mainCategory??image.verdict?.roomType))return false;
  if (favouritesOnly) return favourites.includes(image.id);
  if (image.categorisation && !image.categorisation.isRoom && image.categorisation.mainCategory !== 'Exterior') return false;
  const isUncategorised = !image.categorisation || image.categorisation.mainCategory === 'Other';
  if (isUncategorised && !isRoomImage(image)) return false;
  return image.verdict?.matches || includeUnclassified;
 });

 const isInterior=galleryScope?.kind==='interiors';
 const isDevelopment=Boolean(introduction?.developmentDetails);
 const homeMatches=(image:(typeof available)[number],home:(typeof available)[number]['homes'][number],f:typeof filters)=>matchesSelection(f.building,homeTypeName(home.buildingName??home.name).toLowerCase())&&(!f.minBeds||(home.bedrooms!==null&&home.bedrooms>=Number(f.minBeds)))&&(!f.maxBeds||(home.bedrooms!==null&&home.bedrooms<=Number(f.maxBeds)))&&(!f.minPrice||(home.price!==null&&home.price>=Number(f.minPrice)))&&(!f.maxPrice||(home.price!==null&&home.price<=Number(f.maxPrice)))&&matchesSelection(f.bedrooms,String(home.bedrooms))&&matchesSelection(f.site,home.development)&&matchesSelection(f.development,home.developmentUrl)&&matchesAnySelection(f.location,places?.[`${image.slug}:${home.developmentUrl}`]??[]);
 const matches=(image:(typeof available)[number],f:typeof filters)=>{
  if(!matchesSelection(f.developer,image.developer))return false;
  if(!matchesAnySelection(f.colour,interiorTags(image.categorisation).colour)||!matchesAnySelection(f.tag,interiorTags(image.categorisation).tag))return false;
  if((f.building||f.minBeds||f.maxBeds||f.minPrice||f.maxPrice||f.bedrooms||f.location||f.site||f.development)&&!image.homes.some(home=>homeMatches(image,home,f)))return false;
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
    ...(cat?.decor??[]),...(cat?.wallpaperTags??[]),...(cat?.curtainTags??[]),...(cat?.fabricTags??[]),...(cat?.furnishingTags??[]),
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
 const remote=useGalleryQuery(galleryScope,galleryPage,filters,favourites,initialImage,filtersReady);
 const images:GalleryImage[]=remote?.images??available.filter(image=>matches(image,filters));
 const matchingHomes=images.flatMap(image=>image.homes.filter(home=>homeMatches(image,home,filters)).map(home=>({home,slug:image.slug})));
 const interiorImages=images.filter(image=>image.categorisation?image.categorisation.isRoom:Boolean(image.verdict?.matches)&&image.verdict?.roomType!=='Exterior');
 const roomNames=images.map(image=>image.categorisation?.mainCategory??(image.verdict?.matches?(/office|study/i.test(image.verdict.roomType??'')?'Study & Home Office':image.verdict.roomType?.replace(/[_-]/g,' ').replace(/\b\w/g,c=>c.toUpperCase())??'Study & Home Office'):'Uncategorised'));
 const resultCounts=isDevelopment?{
  'Building Types':new Set(matchingHomes.filter(({home})=>homeTypeName(home.name)!=='Development gallery').map(({home,slug})=>`${slug}:${homeTypeName(home.name).toLowerCase()}`)).size,
  'Room Types':new Set(roomNames.filter(name=>!['Exterior','Other','Uncategorised'].includes(name))).size,
  Interiors:new Set(interiorImages.map(image=>image.uid)).size,
 }:{'Unique images':images.length,Developments:new Set(matchingHomes.map(({home,slug})=>`${slug}:${home.developmentUrl}`)).size,Properties:new Set(matchingHomes.map(({home,slug})=>`${slug}:${home.url}`)).size};
 const fixedLocalCounts=useRef(resultCounts);
 const displayedCounts=overviewOnly?introduction?.counts??resultCounts:remote?.counts??(cascadingFiltersEnabled()?resultCounts:fixedLocalCounts.current);
 const facet=(key:keyof typeof filters)=>!cascadingFiltersEnabled()?available:available.filter(image=>matches(image,{...filters,[key]:''}));
 const mainCategories=remote?.facets.category??[...new Set(facet('category').map(i=>i.categorisation?.mainCategory).filter((v):v is string=>Boolean(v)))].sort();
 const subCategories=remote?.facets.room??[...new Set(facet('room').map(i=>i.categorisation?.subCategory).filter((v):v is string=>Boolean(v)))].sort();
 const facetHomes=(key:keyof typeof filters)=>facet(key).flatMap(image=>image.homes.filter(home=>!cascadingFiltersEnabled()||homeMatches(image,home,{...filters,[key]:''})).map(home=>({home,slug:image.slug})));
 const sites=remote?.facets.development??[...new Map(facetHomes('development').map(({home})=>[home.developmentUrl,home.development])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
 const builderOptions=remote?.facets.developer??[...new Set(facet('developer').map(i=>i.developer))].sort();
 const bedroomOptions=remote?.facets.bedrooms??[...new Set(facetHomes('bedrooms').map(({home})=>home.bedrooms).filter((n):n is number=>n!==null))].sort((a,b)=>a-b);
 const areaOptions=remote?.facets.location??[...new Set(facetHomes('location').flatMap(({home,slug})=>places?.[`${slug}:${home.developmentUrl}`]??[]))].sort();
 const siteOptions=remote?.facets.site??[...new Set(facetHomes('site').map(({home})=>home.development))].sort();

 const rangeHomes=(range:'bedrooms'|'price')=>{
  if(!cascadingFiltersEnabled())return available.flatMap(image=>image.homes);
  const remaining={...filters,...(range==='bedrooms'?{minBeds:'',maxBeds:''}:{minPrice:'',maxPrice:''})};
  return available.filter(image=>matches(image,remaining)).flatMap(image=>image.homes.filter(home=>homeMatches(image,home,remaining)));
 };
 const bedsRange=bedroomRangeOptions(rangeHomes('bedrooms').map(home=>home.bedrooms).filter((value):value is number=>value!==null),filters.minBeds,filters.maxBeds);
 const pricesRange=priceRangeOptions(rangeHomes('price').map(home=>home.price).filter((value):value is number=>value!==null));
 const changeRange=(key:'minBeds'|'maxBeds'|'minPrice'|'maxPrice',value:string)=>setFilters(previous=>({...previous,[key]:value,...(key==='minBeds'&&value&&previous.maxBeds&&Number(value)>Number(previous.maxBeds)?{maxBeds:value}:{}),...(key==='minPrice'&&value&&previous.maxPrice&&Number(value)>Number(previous.maxPrice)?{maxPrice:value}:{}),...(key==='maxPrice'&&value&&previous.minPrice&&Number(value)<Number(previous.minPrice)?{minPrice:value}:{})}));

 const [viewerImage,setViewerImage]=useState<GalleryImage|null>(null);
 const viewerSequence=useRef(0);
 useEffect(()=>{viewerSequence.current++;setViewerImage(null);},[remote?.identity]);
 const current = images.find(i => i.uid === selected)??(viewerImage?.uid===selected?viewerImage:undefined);
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
  viewerSequence.current++;setViewerImage(null);
  setSelected(uid);
  showControls();
  dialog.current?.showModal();
 }

 useEffect(() => {
  if (!ready || !initialImage || openedInitialImage.current === initialImage) return;
  openedInitialImage.current = initialImage;
  const requested=images.find(image => image.uid === initialImage||image.imageUid===initialImage);
  if (requested) {
   setHeroId(requested.uid);
   open(requested.uid);
  }
 }, [ready, initialImage, images.map(image => image.uid).join('|')]);

 async function step(direction: number) {
  showControls();
  if(remote&&current?.position!==undefined&&remote.total){const position=(current.position+direction+remote.total)%remote.total;const loaded=remote.images.find(i=>i.position===position);if(loaded){setViewerImage(null);setSelected(loaded.uid);return;}const sequence=++viewerSequence.current,next=await remote.getImage(position);if(next&&sequence===viewerSequence.current){setViewerImage(next);setSelected(next.uid);}return;}
  const index = images.findIndex(i => i.uid === selected);
  setSelected(images[(index + direction + images.length) % images.length]?.uid ?? null);
 }

 return (
  <section aria-label="Image collection" className={featured ? 'featured-gallery' : undefined}>
   {introduction && <>
    <section className={`results-hero${introduction.details?' builder-results-hero':introduction.titleAccessory?` development-results-hero${introduction.developmentDetails?' development-three-column':''}`:''}`}>
     {introduction.details&&introduction.back&&<BreadcrumbBack className="results-back builder-results-back" href={introduction.back.href}>{introduction.back.label}</BreadcrumbBack>}
     {introduction.titleAccessory&&introduction.back&&<BreadcrumbBack className="results-back development-results-back" href={introduction.back.href}>{introduction.back.label}</BreadcrumbBack>}
     {introduction.developmentDetails?<>
      <div className="results-hero-copy development-logo-column"><h1>{introduction.title}</h1><p>{introduction.description}</p>{introduction.developmentLocation}</div>
      <div className="development-details-column">{introduction.developmentDetails}</div>
     </>:<div className="results-hero-copy">
      {!introduction.details&&!introduction.titleAccessory&&introduction.back && <BreadcrumbBack className="results-back" href={introduction.back.href}>{introduction.back.label}</BreadcrumbBack>}
      {introduction.eyebrow&&<p className="eyebrow">{introduction.eyebrow}</p>}
      {introduction.titleAccessory?<div className="development-title-row"><h1>{introduction.title}</h1>{introduction.titleAccessory}</div>:<h1>{introduction.title}</h1>}
      <p>{introduction.description}</p>
      {!introduction.details&&<a className="results-cta" href="#collection">Discover the collection ↓</a>}
     </div>}
     {introduction.details&&<div className="builder-results-details">{introduction.details}</div>}
     {(heroImage||introduction.map) && <div ref={hero} className={`results-hero-photo${selected || pageHidden || heroInteracting || !heroPlaying ? ' is-paused' : ''}${heroInteracting?' is-interacting':''}${!heroPlaying?' is-manually-paused':''}`} onMouseEnter={() => setHeroInteracting(true)} onMouseLeave={restartHeroProgress} onFocus={() => setHeroInteracting(true)} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) restartHeroProgress();
     }} role="region" aria-label="Builder developments and image carousel" onKeyDown={e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); heroStep(e.key === 'ArrowLeft' ? -1 : 1); }
     }}>
      {heroId==='builder-map'&&introduction.map?<div className="builder-hero-map">{introduction.map}</div>:heroImage?<><button className="results-hero-image" onClick={() => open(heroImage.uid)} aria-label="Open current image fullscreen"><AnimatedGalleryImage key={heroImage.uid} src={imageUrl(heroImage.slug, heroImage.path)} alt={heroImage.verdict?.description ?? 'Showhome interior'}/></button>
      </>:null}
      {introduction.developmentDetails&&introduction.titleAccessory&&<div className="development-carousel-logo">{introduction.titleAccessory}</div>}
      <div key={`${heroId==='builder-map'?'builder-map':heroImage?.uid}:${heroTimerVersion}`} className="results-hero-room-type">
       {heroId==='builder-map'?'Developments':roomLabel(heroImage?.categorisation?.subCategory??heroImage?.categorisation?.mainCategory??'Showhome interior')}
      </div>
      {heroImages.length+(introduction.map?1:0)>1&&<div className="results-slide-progress" aria-hidden="true"><span key={`${heroId==='builder-map'?'builder-map':heroImage?.uid}:${heroTimerVersion}`} onAnimationEnd={()=>{if(heroPlaying&&!selected&&!pageHidden&&!heroInteracting)heroStep(1);}}/></div>}
      {introduction.map&&<button className="results-hero-playback" aria-label={heroPlaying?'Pause carousel':'Play carousel'} onClick={()=>{setHeroPlaying(playing=>!playing);setHeroTimerVersion(version=>version+1);}}>
       <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">{heroPlaying?<><rect x="3" y="2" width="3" height="12" rx="1"/><rect x="10" y="2" width="3" height="12" rx="1"/></>:<path d="M4 2.5v11L13 8z"/>}</svg>
      </button>}
      <button className="results-arrow results-prev" onClick={() => heroStep(-1)} aria-label="Previous preview image">‹</button>
      <button className="results-arrow results-next" onClick={() => heroStep(1)} aria-label="Next preview image">›</button>
     </div>}
     {introduction.details&&introduction.counts&&<div className="results-stats builder-results-stats">{Object.entries(introduction.counts).map(([label,count])=><div key={label}><strong><RollingCount key={count} value={count}/></strong><span>{label}</span></div>)}</div>}
    </section>
    {!introduction.details&&<div className="results-stats" aria-live="polite">
     {Object.entries(displayedCounts).map(([label,count])=><div key={label}><strong>{favouritesOnly&&!ready?'…':<RollingCount key={count} value={count}/>}</strong><span>{label}</span></div>)}
    </div>}
    {!overviewOnly&&<div className="results-heading" id="collection"><h2>{favouritesOnly ? 'Your saved spaces' : isDevelopment?'Explore the development':'Explore the collection'}</h2></div>}
   </>}
   {!overviewOnly&&<>
   {!featured && <><div className={isDevelopment?'site-filter-panel development-detail-filter-panel':isInterior?'site-filter-panel interior-filter-panel':undefined}><DirectoryFilters pending={Boolean(remote?.loading)} className={isDevelopment?'filters site-filters development-detail-filters':isInterior?'filters site-filters location-primary-filters':'filters'} label={isDevelopment?'Development filters':'Collection filters'}>
    {isDevelopment?<>
     <fieldset className="development-range-filter"><legend>Bedrooms Range</legend><div>
      <SingleSelectFilter label="Minimum bedrooms" value={bedsRange.minValue} options={[{value:'',label:'Any'},...bedsRange.minNumbers.map(value=>({value:String(value),label:`${value} Beds`}))]} onChange={value=>changeRange('minBeds',value)}/>
      <span aria-hidden="true">–</span>
      <SingleSelectFilter label="Maximum bedrooms" value={bedsRange.maxValue} options={[{value:'',label:'Any'},...bedsRange.maxNumbers.map(value=>({value:String(value),label:`${value} Beds`}))]} onChange={value=>changeRange('maxBeds',value)}/>
     </div></fieldset>
     <fieldset className="development-range-filter"><legend>Price Range (£)</legend><div>
      <MoneyInput label="Minimum price" value={filters.minPrice} options={pricesRange.options.filter(price=>!filters.maxPrice||price<=Number(filters.maxPrice))} onChange={value=>changeRange('minPrice',value)}/>
      <span aria-hidden="true">–</span>
      <MoneyInput label="Maximum price" value={filters.maxPrice} options={pricesRange.options.filter(price=>!filters.minPrice||price>=Number(filters.minPrice))} onChange={value=>changeRange('maxPrice',value)}/>
     </div></fieldset>
    </>:isInterior?<>
     <MultiSelectFilter label="Builders" value={filters.developer} options={builderOptions} onChange={value=>setFilters(previous=>({...previous,developer:value}))}/>
     <MultiSelectFilter label="Building Types" value={filters.building} options={(remote?.facets.building??[...new Set(facetHomes('building').map(({home})=>homeTypeName(home.buildingName??home.name).toLowerCase()))]).map(value=>({value,label:homeTypeName(value).replace(/\b\w/g,letter=>letter.toUpperCase())}))} onChange={value=>setFilters(previous=>({...previous,building:value}))}/>
     <MultiSelectFilter colourSwatches label="Colour" value={filters.colour} options={remote?.facets.colour??[...new Set(facet('colour').flatMap(image=>interiorTags(image.categorisation).colour))]} onChange={value=>setFilters(previous=>({...previous,colour:value}))}/>
     <MultiSelectFilter label="Tags" value={filters.tag} options={remote?.facets.tag??[...new Set(facet('tag').flatMap(image=>interiorTags(image.categorisation).tag))]} onChange={value=>setFilters(previous=>({...previous,tag:value}))}/>
    </>:<>
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
    <MultiSelectFilter label="Developments" value={development} options={sites.map(([value,label])=>({value,label:developmentName(label)}))} onChange={setDevelopment}/>
    {places&&<>
     <MultiSelectFilter label="Bedrooms" value={filters.bedrooms} options={bedroomOptions.map(n=>({value:String(n),label:`${n} bedrooms`}))} onChange={value=>setFilters(previous=>({...previous,bedrooms:value}))}/>
     <MultiSelectFilter label="Areas" value={filters.location} options={areaOptions} onChange={value=>setFilters(previous=>({...previous,location:value}))}/>
     <MultiSelectFilter label="Developments" value={filters.site} options={siteOptions.map(value=>({value,label:developmentName(value)}))} onChange={value=>setFilters(previous=>({...previous,site:value}))}/>
    </>}
    </>}
    <button className={isDevelopment||isInterior?'location-filter-reset':'results-reset'} onClick={() => setFilters(galleryDefaults)}>Reset</button>
   </DirectoryFilters></div>

   <div className="directory-toolbar" style={{ marginTop: 24 }}>
    <div className="directory-view-status"><ViewOptions view={view} onChange={changeView} ariaLabel="Image card layout" />
    <DirectoryQueryStatus query={remote} visible/></div>
    <p className="count" style={{ margin: 0 }}>
     {favouritesOnly && !ready
      ? 'Loading favourites…'
      : `${remote?.total??images.length} ${(remote?.total??images.length) === 1 ? 'image' : 'images'}`}
    </p>
   </div>

   </>}
   {featured&&<DirectoryQueryStatus query={remote}/>}
   <div ref={resultsStart} aria-hidden="true"/>
   <GalleryCardResults featured={featured} hasMore={remote?.hasMore} loading={remote?.loading} replacing={remote?.replacing} onLoadMore={remote?.loadMore} className={featured ? 'image-grid home-featured-grid' : `image-grid image-grid-${view}`} label="Interiors" identity={JSON.stringify([filters,favouritesOnly])} paginate={!featured}>
    {images.map(image => (
     <article className="image-card" key={image.uid}>
      <div className="results-photo-frame">
      <button
       className="photo-button"
       onClick={() => open(image.uid)}
       aria-label={`Enlarge ${image.verdict?.description ?? 'gallery image'}`}
      >
       <CardImage
        loading="lazy"
        src={imageUrl(image.slug, image.path)}
        alt={image.verdict?.description ?? 'Showhome interior'}
       />
       {image.categorisation?.subCategory!==''&&<span className="photo-caption">{roomLabel(image.categorisation?.subCategory ?? 'Showhome interior')}</span>}
      </button>
      <button className="results-save" onClick={() => toggle(image.id)} aria-pressed={favourites.includes(image.id)} aria-label={favourites.includes(image.id) ? 'Remove from favourites' : 'Add to favourites'} dangerouslySetInnerHTML={{ __html: heartIcon }}/>
      </div>

      <div className="image-body">
       {featured ? <><h3>{image.categorisation?.mainCategory ?? 'Showhome interior'}</h3><p className="subtle">{image.developer}</p></> : <>
       <div className="image-heading">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
         <p className="eyebrow" style={{ margin: 0 }}>{image.developer}</p>
         {image.categorisation?.subCategory && (
          <span className="badge-pill">{roomLabel(image.categorisation.subCategory)}</span>
         )}
        </div>
       </div>

       <h3>{[...new Set(image.homes.map(home => homeTypeName(home.name)))].join(' · ') || image.developer}</h3>
       <p className="subtle">{image.verdict?.description ?? 'Showhome interior'}</p>

       {image.categorisation && (
        <div className="feature-tags">
         {image.categorisation.colours.slice(0, 3).map(c => (
          <button type="button" key={c} className="tag tag-colour" aria-pressed={tagSelected(c)} onClick={()=>toggleTag(c)} title={`Filter by ${c}`}>{c}</button>
         ))}
         {image.categorisation.hasTelevision && (
          <span className="tag tag-tech" title="Television present">📺 TV</span>
         )}
         {image.categorisation.hasComputer && (
          <span className="tag tag-tech" title="Computer / Workspace present">💻 PC</span>
         )}
         {[...new Set([...(image.categorisation.decor??[]),...(image.categorisation.wallpaperTags??[]),...(image.categorisation.curtainTags??[]),...(image.categorisation.fabricTags??[]),...(image.categorisation.furnishingTags??[])])].map(tag=><button type="button" key={tag} className="tag tag-decor" aria-pressed={tagSelected(tag)} onClick={()=>toggleTag(tag)} title={`Filter by ${tag}`}>{tag}</button>)}
         {image.categorisation.wallpaper && (
          <button type="button" className="tag tag-decor" aria-pressed={tagSelected(image.categorisation.wallpaper)} onClick={()=>toggleTag(image.categorisation!.wallpaper!)}>{image.categorisation.wallpaper}</button>
         )}
         {image.categorisation.curtains && (
          <button type="button" className="tag tag-decor" aria-pressed={tagSelected(image.categorisation.curtains)} onClick={()=>toggleTag(image.categorisation!.curtains!)}>{image.categorisation.curtains}</button>
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
           {developmentName(home.development)} · {home.bedrooms} beds
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
   </GalleryCardResults>

   {!images.length && ready && !remote?.loading && (
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
     viewerSequence.current++;setViewerImage(null);setSelected(null);
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
