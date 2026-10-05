import { readFile } from 'node:fs/promises';
import { existsSync,readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RunReport } from '../reports/report';

import { developers } from '../adapters/developers';
export { developers };
export function collectionFolder(slug: string) {
 if (!developers.some(d => d.slug === slug)) throw new Error('Unknown developer');
 const published=resolve('collections',`${slug}-home-offices`),canonical=resolve('results',`${slug}-home-offices`);
 const candidates=[published,canonical];
 try{
  const manifest=JSON.parse(readFileSync(resolve('results/.cache/remaining-builder-scan-state.json'),'utf8'));
  const folder=manifest[slug]?.folder;
  if(typeof folder==='string'&&folder.startsWith('results/')){
   const candidate=resolve(folder);if(candidate.startsWith(resolve('results')+'/'))candidates.push(candidate);
  }
 }catch{/* Published data remains available without a crawl manifest. */}
 const complete=candidates.flatMap(folder=>{
  try{const report=JSON.parse(readFileSync(folder+'/results.json','utf8')) as RunReport;
   return ['completed','completed_with_gaps'].includes(report.status)?[{folder,time:Date.parse(report.completedAt??report.startedAt)}]:[];
  }catch{return [];}
 }).sort((a,b)=>b.time-a.time);
 return complete[0]?.folder??(existsSync(published+'/results.json')?published:canonical);
}
export async function readCollection(slug: string): Promise<RunReport | null> {
 const folder = collectionFolder(slug);
 const reports = await Promise.all(['results.json', 'checkpoint.json'].map(async file => {
  try { return JSON.parse(await readFile(`${folder}/${file}`, 'utf8')) as RunReport; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
 }));
 return reports.filter((r): r is RunReport => r !== null).sort((a, b) => Date.parse(b.completedAt ?? b.startedAt) - Date.parse(a.completedAt ?? a.startedAt))[0] ?? null;
}
export function assetUrl(slug: string, path: string) {
 return `/api/assets/${slug}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
