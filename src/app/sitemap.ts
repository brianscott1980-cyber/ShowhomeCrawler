import type {MetadataRoute} from 'next';
import {readWebsiteSitemap} from '../database/website';
import {absoluteUrl} from '../web/seo';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const {cards,builders,roomColours}=await readWebsiteSitemap();
 const entries:MetadataRoute.Sitemap=['/','/builders','/developments','/interiors','/buildings'].map(href=>({url:absoluteUrl(href)}));
 for(const builder of builders){
  const lastModified=builder.completed_at&&Number.isFinite(Date.parse(builder.completed_at))?{lastModified:builder.completed_at}:{};
  entries.push({url:absoluteUrl(`/builders/${builder.slug}`),...lastModified});
  if(builder.developments)entries.push({url:absoluteUrl(`/developments/${builder.slug}`),...lastModified});
  if(builder.buildings)entries.push({url:absoluteUrl(`/buildings/${builder.slug}`),...lastModified});
 }
 for(const room of roomColours)entries.push({url:absoluteUrl(`${room.href}/${room.colour}`)});
 for(const card of cards)if(card.href&&!card.href.startsWith('/builders/'))entries.push({url:absoluteUrl(card.href)});
 return [...new Map(entries.map(entry=>[entry.url,entry])).values()];
}
