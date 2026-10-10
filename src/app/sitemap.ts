import {readDevelopmentPublicRoutes} from '../database/development-public-routes';
import type {MetadataRoute} from 'next';
import {readWebsiteSitemap} from '../database/website';
import {absoluteUrl} from '../web/seo';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const [{cards,builders},{canonical}]=await Promise.all([readWebsiteSitemap(),readDevelopmentPublicRoutes()]);
 const entries:MetadataRoute.Sitemap=['/','/builders','/developments','/interiors','/buildings','/furnishings'].map(href=>({url:absoluteUrl(href)}));
 for(const builder of builders){
  const lastModified=builder.completed_at&&Number.isFinite(Date.parse(builder.completed_at))?{lastModified:builder.completed_at}:{};
  entries.push({url:absoluteUrl(`/builders/${builder.slug}`),...lastModified});
  if(builder.developments)entries.push({url:absoluteUrl(`/developments/${builder.slug}`),...lastModified});
  if(builder.buildings)entries.push({url:absoluteUrl(`/buildings/${builder.slug}`),...lastModified});
 }
 for(const card of cards)if(card.href&&!card.href.startsWith('/builders/'))entries.push({url:absoluteUrl(canonical[card.href]??card.href)});
 return [...new Map(entries.map(entry=>[entry.url,entry])).values()];
}
