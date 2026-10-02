'use client';
import {BuilderName} from './builder-name';
import {useState} from 'react';
import {matchesBuildingPlace,type BuildingPlace} from './building-place-filter';
import {ScrollCollectionImage,type CollectionImage} from './scroll-collection-image';
import Link from 'next/link';
import {ViewOptions,useCardView,type CardViewMode} from './view-options';

export interface GroupCardItem {
 key: string;
 name: string;
 developers: string[];
 count: number;
 images?: CollectionImage[];
 image: string;
 description: string;
 bedrooms?: number[];
 locations?: string[];
 sites?: string[];
 places?: BuildingPlace[];
}

export function GroupCards({
 cards,
 pathPrefix,
 kindLabel,
 defaultView = pathPrefix === 'buildings' ? 'compact' : 'large',
 storageKey = pathPrefix === 'buildings' ? 'showhome-buildings-view' : 'showhome-interiors-view',
}: {
 cards: GroupCardItem[];
 pathPrefix: string;
 kindLabel: string;
 defaultView?: CardViewMode;
 storageKey?: string;
}) {
 const [view, changeView] = useCardView(storageKey, defaultView);
 const [developer, setDeveloper] = useState('');
 const [bedrooms, setBedrooms] = useState('');
 const [location, setLocation] = useState('');
 const [site,setSite]=useState('');

 const isBuildings = pathPrefix === 'buildings';

 const developers = isBuildings
  ? [...new Set(cards.flatMap(c => c.developers))].sort()
  : [];

 const bedroomOptions = isBuildings
  ? [...new Set(cards.flatMap(c => c.bedrooms ?? []))].sort((a, b) => a - b)
  : [];

 const locationOptions = isBuildings
  ? [...new Set(cards.flatMap(c => c.locations ?? []))].sort()
  : [];

 const siteOptions=isBuildings?[...new Set(cards.flatMap(c=>c.sites??[]))].sort():[];
 const visible = isBuildings
  ? cards.filter(card => {
     if (developer && !card.developers.includes(developer)) return false;
     if (bedrooms && !card.bedrooms?.includes(Number(bedrooms))) return false;
     if ((site||location)&&!matchesBuildingPlace(card.places??[],site,location)) return false;
     return true;
    })
  : cards;

 const hasActiveFilters = Boolean(developer || bedrooms || location || site);
 const imageLayout=`${view}:${visible.map(c=>c.key).join(",")}`;

 function resetFilters() {
  setDeveloper('');
  setBedrooms('');
  setLocation('');
  setSite('');
 }

 return (
  <>
   {isBuildings && (
    <div className="site-filter-panel" style={{marginBottom: 24}}>
     <div className="filters site-filters" role="search" aria-label="Filter buildings">
      <label>
       Homebuilder
       <select value={developer} onChange={e => setDeveloper(e.target.value)}>
        <option value="">All homebuilders</option>
        {developers.map(d => (
         <option key={d} value={d}>{d}</option>
        ))}
       </select>
      </label>
      <label>
       Bedrooms
       <select value={bedrooms} onChange={e => setBedrooms(e.target.value)}>
        <option value="">All bedrooms</option>
        {bedroomOptions.map(b => (
         <option key={b} value={String(b)}>{b} {b === 1 ? 'bedroom' : 'bedrooms'}</option>
        ))}
       </select>
      </label>
      <label>
       Location
       <select value={location} onChange={e => setLocation(e.target.value)}>
        <option value="">All locations</option>
        {locationOptions.map(l => (
         <option key={l} value={l}>{l}</option>
        ))}
       </select>
      </label>
      <label>
       Site
       <select value={site} onChange={e=>setSite(e.target.value)}>
        <option value="">All sites</option>
        {siteOptions.map(s=><option key={s} value={s}>{s}</option>)}
       </select>
      </label>
      {hasActiveFilters && (
       <button
        type="button"
        onClick={resetFilters}
        style={{alignSelf: 'end', height: 46, padding: '0 16px', background: 'transparent', border: '1px solid var(--line)', cursor: 'pointer'}}
       >
        Reset filters
       </button>
      )}
     </div>
    </div>
   )}
   <div className="directory-toolbar">
    <ViewOptions view={view} onChange={changeView} ariaLabel={`${kindLabel} layout`} />
    <p className="count" style={{margin:0}} aria-live="polite">
     {hasActiveFilters ? `${visible.length} of ${cards.length} ${kindLabel.toLowerCase()}` : `${cards.length} ${kindLabel.toLowerCase()}`}
    </p>
   </div>
   <div className={`collection-grid directory-${view}`}>
    {visible.map(card => (
     <Link className="collection-card" href={`/${pathPrefix}/${card.key}`} key={card.key}>
      <ScrollCollectionImage images={card.images} image={card.image} description={card.description} layout={imageLayout}/>
      <div className="card-body">
       <h2>{card.name}</h2>
       <p className="subtle">{card.developers.map((name,i)=><span key={name}>{i>0?' · ':''}<BuilderName name={name}/></span>)}</p>
       {card.bedrooms && card.bedrooms.length > 0 && (
        <p className="subtle">
         {card.bedrooms.map(b => `${b} bed`).join(' · ')}
         {card.sites && card.sites.length > 0 && ` · ${card.sites.length === 1 ? card.sites[0] : `${card.sites.length} sites`}`}
        </p>
       )}
       <p>{card.count} {card.count === 1 ? 'image' : 'images'}</p>
       <span className="subtle">Explore collection →</span>
      </div>
     </Link>
    ))}
   </div>
   {!cards.length && <p className="empty">No {kindLabel.toLowerCase()} available yet.</p>}
   {Boolean(cards.length && !visible.length) && (
    <p className="empty">No {kindLabel.toLowerCase()} match these filters. Try widening your search.</p>
   )}
  </>
 );
}
