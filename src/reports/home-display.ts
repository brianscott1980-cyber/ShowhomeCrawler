import type { ReportProperty } from './report.js';
export function homeTypeName(name: string): string {
 const cleaned=cleanHomeName(name).replace(/\bMore\s+Information\b/gi,'').replace(/\s+/g,' ').replace(/^Plot\s+\S+\s*[-–—]\s*/i, '').replace(/\s*·\s*Plot\s+\S+.*$/i, '').replace(/\s*[-–—·|:]\s*$/,'').trim();
 return uniqueHomeTypeNames(cleaned.split(/\s*·\s*/)).map(text=>text===text.toUpperCase()&&/[A-Z]/.test(text)?text.toLowerCase().replace(/(^|[\s-])([a-z])/g,(_,prefix:string,letter:string)=>prefix+letter.toUpperCase()):text).join(' · ');
}
export function uniqueHomeTypeNames(names:string[]):string[]{
 const unique=new Map<string,string>();
 for(const name of names){const text=name.trim();if(!text)continue;const key=text.toLowerCase(),previous=unique.get(key);
  if(!previous||previous===previous.toUpperCase()&&text!==text.toUpperCase())unique.set(key,text);
 }
 return [...unique.values()];
}
export function plotDetails(home: ReportProperty): string {
 return [...new Map(home.plots.filter(p => p.number).map(p => [p.number, p])).values()]
  .map(p => `Plot ${p.number}${p.price === null ? '' : ' · £' + p.price.toLocaleString('en-GB')}${p.available ? ' · Available' : ' · Not currently available'}`).join('; ');
}

export function cleanHomeName(name:string){
 const decoded=name.replace(/&(?:nbsp|amp|quot|lt|gt|#39);/g,entity=>({'&nbsp;':' ','&amp;':'&','&quot;':'"','&lt;':'<','&gt;':'>','&#39;':"'"}[entity]??' '));
 const text=decoded.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 const alt=decoded.match(/<img\b[^>]*\balt\s*=\s*["']([^"']+)["']/i)?.[1];
 return text||alt?.trim()||'Home type';
}

/** Plot identifiers are not house-type names; retain their source records separately. */
export function isPlotName(name:string):boolean{
 const text=cleanHomeName(name);
 return /^\d/.test(text)||/\b(?:plot|development|block)\b/i.test(text);
}
