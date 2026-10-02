'use client';
import {useEffect,useState} from 'react';

export type CardViewMode = 'large' | 'compact' | 'list';

export function LargeCardsIcon() {
 return (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true" style={{display:'block'}}>
   <rect x="2" y="2" width="6.5" height="6.5" rx="1"/>
   <rect x="9.5" y="2" width="6.5" height="6.5" rx="1"/>
   <rect x="2" y="9.5" width="6.5" height="6.5" rx="1"/>
   <rect x="9.5" y="9.5" width="6.5" height="6.5" rx="1"/>
  </svg>
 );
}

export function SmallCardsIcon() {
 return (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true" style={{display:'block'}}>
   <rect x="2" y="2" width="3.5" height="3.5" rx="0.5"/>
   <rect x="7.25" y="2" width="3.5" height="3.5" rx="0.5"/>
   <rect x="12.5" y="2" width="3.5" height="3.5" rx="0.5"/>
   <rect x="2" y="7.25" width="3.5" height="3.5" rx="0.5"/>
   <rect x="7.25" y="7.25" width="3.5" height="3.5" rx="0.5"/>
   <rect x="12.5" y="7.25" width="3.5" height="3.5" rx="0.5"/>
   <rect x="2" y="12.5" width="3.5" height="3.5" rx="0.5"/>
   <rect x="7.25" y="12.5" width="3.5" height="3.5" rx="0.5"/>
   <rect x="12.5" y="12.5" width="3.5" height="3.5" rx="0.5"/>
  </svg>
 );
}

export function ListViewIcon() {
 return (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true" style={{display:'block'}}>
   <rect x="2" y="2.5" width="4" height="3" rx="0.5"/>
   <rect x="7.5" y="3" width="8.5" height="2" rx="0.5"/>
   <rect x="2" y="7.5" width="4" height="3" rx="0.5"/>
   <rect x="7.5" y="8" width="8.5" height="2" rx="0.5"/>
   <rect x="2" y="12.5" width="4" height="3" rx="0.5"/>
   <rect x="7.5" y="13" width="8.5" height="2" rx="0.5"/>
  </svg>
 );
}

export const viewOptionItems = [
 {value: 'large' as const, label: 'Large cards', icon: <LargeCardsIcon/>},
 {value: 'compact' as const, label: 'Smaller grid', icon: <SmallCardsIcon/>},
 {value: 'list' as const, label: 'List', icon: <ListViewIcon/>},
];

export function useCardView(storageKey = 'showhome-directory-view', defaultView: CardViewMode = 'large') {
 const [view, setView] = useState<CardViewMode>(defaultView);
 useEffect(() => {
  try {
   const saved = sessionStorage.getItem(storageKey);
   if (saved === 'large' || saved === 'compact' || saved === 'list') {
    setView(saved);
    return;
   }
  } catch {}
  setView(defaultView);
 }, [storageKey, defaultView]);
 function changeView(next: CardViewMode) {
  setView(next);
  try {
   sessionStorage.setItem(storageKey, next);
  } catch {}
 }
 return [view, changeView] as const;
}

export function ViewOptions({
 view,
 onChange,
 ariaLabel = 'Card layout',
}: {
 view: CardViewMode;
 onChange: (mode: CardViewMode) => void;
 ariaLabel?: string;
}) {
 return (
  <div className="view-options" role="group" aria-label={ariaLabel}>
   {viewOptionItems.map(item => (
    <button
     key={item.value}
     type="button"
     aria-pressed={view === item.value}
     aria-label={item.label}
     title={item.label}
     onClick={() => onChange(item.value)}
    >
     {item.icon}
     <span className="sr-only">{item.label}</span>
    </button>
   ))}
  </div>
 );
}
