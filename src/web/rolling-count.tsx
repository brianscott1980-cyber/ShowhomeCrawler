import {cascadingFiltersEnabled} from './filter-settings';
import type { CSSProperties } from 'react';

export function RollingCount({ value }: { value: number }) {
 const formatted = value.toLocaleString('en-GB');
 if(!cascadingFiltersEnabled())return <span className="rolling-count">{formatted}</span>;
 return <span className="rolling-count">
  <span className="sr-only">{formatted}</span>
  <span className="rolling-count-visual" aria-hidden="true">{[...formatted].map((character, index) => {
   if (!/\d/.test(character)) return <span key={index}>{character}</span>;
   const last = 30 + Number(character);
   const style = { '--roll-end': `${-last * 1.15}em`, '--roll-delay': `${index * 80}ms` } as CSSProperties;
   return <span className="rolling-digit" key={index}><span className="rolling-digit-strip" style={style}>{Array.from({ length: last + 1 }, (_, row) => <span key={row}>{row % 10}</span>)}</span></span>;
  })}</span>
 </span>;
}
