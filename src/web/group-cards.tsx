'use client';
import Link from 'next/link';
import {ViewOptions,useCardView,type CardViewMode} from './view-options';

export interface GroupCardItem {
 key: string;
 name: string;
 developers: string[];
 count: number;
 image: string;
 description: string;
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
 return (
  <>
   <div className="directory-toolbar">
    <ViewOptions view={view} onChange={changeView} ariaLabel={`${kindLabel} layout`} />
    <p className="count" style={{margin:0}}>{cards.length} {kindLabel.toLowerCase()}</p>
   </div>
   <div className={`collection-grid directory-${view}`}>
    {cards.map(card => (
     <Link className="collection-card" href={`/${pathPrefix}/${card.key}`} key={card.key}>
      <img loading="lazy" src={card.image} alt={card.description} />
      <div className="card-body">
       <h2>{card.name}</h2>
       <p className="subtle">{card.developers.join(' · ')}</p>
       <p>{card.count} {card.count === 1 ? 'image' : 'images'}</p>
       <span className="subtle">Explore collection →</span>
      </div>
     </Link>
    ))}
   </div>
   {!cards.length && <p className="empty">No {kindLabel.toLowerCase()} available yet.</p>}
  </>
 );
}
