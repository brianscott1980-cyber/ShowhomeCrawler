import type { MetadataRoute } from 'next';
import { developers, readCollection, assetUrl } from '../web/collections';
import { absoluteUrl } from '../web/seo';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const collections=await Promise.all(developers.map(async d=>({developer:d,report:await readCollection(d.slug)})));
 return [{url:absoluteUrl('/')},...collections.flatMap(({developer,report})=>{
  const images=report?.images.filter(i=>i.verdict?.matches)??[];if(!images.length)return [];
  const date=report?.completedAt;return [{url:absoluteUrl(`/developers/${developer.slug}`),...(date&&Number.isFinite(Date.parse(date))?{lastModified:date}:{}),images:images.map(i=>absoluteUrl(assetUrl(developer.slug,i.path)))}];
 })];
}
