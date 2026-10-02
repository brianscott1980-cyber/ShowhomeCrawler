import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { RunReport } from '../reports/report';

export const developers = [
 { slug: 'bellway', name: 'Bellway', website: 'https://www.bellway.co.uk' },
 { slug: 'cala', name: 'Cala', website: 'https://www.cala.co.uk' },
] as const;
export function collectionFolder(slug: string) {
 if (!developers.some(d => d.slug === slug)) throw new Error('Unknown developer');
 return resolve('results', `${slug}-home-offices`);
}
export async function readCollection(slug: string): Promise<RunReport | null> {
 const folder = collectionFolder(slug);
 const reports = await Promise.all(['checkpoint.json', 'results.json'].map(async file => {
  try { return JSON.parse(await readFile(`${folder}/${file}`, 'utf8')) as RunReport; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
 }));
 return reports.filter((r): r is RunReport => r !== null).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0] ?? null;
}
export function assetUrl(slug: string, path: string) {
 return `/api/assets/${slug}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
