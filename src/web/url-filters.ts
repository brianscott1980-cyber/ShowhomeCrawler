'use client';
import { useEffect, useRef, useState } from 'react';

/** Filter changes are bookmarkable and Back/Forward restores the controls. */
export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
 const [filters, setFilters] = useState(defaults);
 const latest=useRef(defaults);
 useEffect(() => {
  const read = () => {
   const query = new URLSearchParams(window.location.search);
   const value=Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, query.get(key) ?? value])) as T;
   latest.current=value;setFilters(value);
  };
  read();
  window.addEventListener('popstate', read);
  return () => window.removeEventListener('popstate', read);
 }, [defaults]);
 function change(next: T | ((previous: T) => T)) {
  const value = typeof next === 'function' ? next(latest.current) : next;
  latest.current=value;
  setFilters(value);
  const url = new URL(window.location.href);
  for (const [key, defaultValue] of Object.entries(defaults)) {
   if (value[key] && value[key] !== defaultValue) url.searchParams.set(key, value[key]!);
   else url.searchParams.delete(key);
  }
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
 }
 return [filters, change] as const;
}
