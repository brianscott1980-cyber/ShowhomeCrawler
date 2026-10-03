import type { ReportProperty } from './report.js';
export function homeTypeName(name: string): string {
 return cleanHomeName(name).replace(/^Plot\s+\S+\s*[-–—]\s*/i, '').replace(/\s*·\s*Plot\s+\S+.*$/i, '').trim();
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
