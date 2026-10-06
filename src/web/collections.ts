import {readWebsiteCollection} from '../database/website';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {developers} from '../adapters/developers';
export {developers};
// Files are consulted only for original binary storage, never for website catalogue data.
export function collectionFolder(slug:string){
 if(!developers.some(d=>d.slug===slug))throw new Error('Unknown developer');
 const published=resolve('collections',`${slug}-home-offices`);
 return existsSync(published)?published:resolve('results',`${slug}-home-offices`);
}
export const readCollection=readWebsiteCollection;
export function assetUrl(slug: string, path: string) {
 return `/api/assets/${slug}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
