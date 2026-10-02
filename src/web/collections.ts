import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RunReport } from '../reports/report';

import { developers } from '../adapters/developers';
export { developers };
export function collectionFolder(slug: string) {
 if (!developers.some(d => d.slug === slug)) throw new Error('Unknown developer');
 const published = resolve('collections', `${slug}-home-offices`);
 return existsSync(published + '/results.json') ? published : resolve('results', `${slug}-home-offices`);
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
