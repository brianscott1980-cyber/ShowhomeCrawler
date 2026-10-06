import type {MetadataRoute} from 'next';
import {readWebsiteSitemap} from '../database/website';
import {assetUrl} from '../web/collections';
import {absoluteUrl} from '../web/seo';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const {cards,builders}=await readWebsiteSitemap();
 const entries:MetadataRoute.Sitemap=['/','/builders','/developments','/interiors','/buildings'].map(href=>({url:absoluteUrl(href)}));
 for(const card of cards)if(card.href&&!card.href.startsWith('/builders/'))entries.push({url:absoluteUrl(card.href)});
 for(const builder of builders)entries.push({url:absoluteUrl(`/builders/${builder.slug}`),...(builder.completed_at&&Number.isFinite(Date.parse(builder.completed_at))?{lastModified:builder.completed_at}:{}),images:builder.images.map((path:string)=>absoluteUrl(assetUrl(builder.slug,path)))});
 return entries;
}
