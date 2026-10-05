import type { MetadataRoute } from 'next';
import { developers, readCollection, assetUrl } from '../web/collections';
import {readGroups,type GroupKind} from '../web/groups';
import {groupRoutes} from '../web/group-routes';
import { absoluteUrl } from '../web/seo';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const collections=await Promise.all(developers.map(async d=>({developer:d,report:await readCollection(d.slug)})));
 const grouped=await Promise.all((['locations','interiors','buildings'] as GroupKind[]).map(async kind=>{const groups=await readGroups(kind);return {kind,groups,routes:groupRoutes(kind,groups)};}));
 return [{url:absoluteUrl('/')},{url:absoluteUrl('/builders')},...grouped.flatMap(({kind,groups,routes})=>[{url:absoluteUrl(`/${kind==='locations'?'developments':kind}`)},...groups.map(group=>({url:absoluteUrl(routes.get(group.key)!)}))]),...collections.flatMap(({developer,report})=>{
  const images=report?.images.filter(i=>i.categorisation ? i.categorisation.isRoom || i.categorisation.mainCategory==='Exterior' : i.verdict?.matches)??[];if(!images.length)return [];
  const date=report?.completedAt;return [{url:absoluteUrl(`/builders/${developer.slug}`),...(date&&Number.isFinite(Date.parse(date))?{lastModified:date}:{}),images:images.map(i=>absoluteUrl(assetUrl(developer.slug,i.path)))}];
 })];
}
