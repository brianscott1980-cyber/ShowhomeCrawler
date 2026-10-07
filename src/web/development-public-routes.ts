import {developmentName} from './development-name';
export const developmentSlug=(name:string)=>developmentName(name).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
/** Shared names and builder-slug collisions keep their existing qualified routes. */
export function developmentPublicRoutes(rows:{name:string;href:string}[],builders:string[]){
 const reserved=new Set(builders),groups=new Map<string,typeof rows>();
 for(const row of rows){const slug=developmentSlug(row.name);groups.set(slug,[...groups.get(slug)??[],row]);}
 const canonical:Record<string,string>={},destinations:Record<string,{source:string;canonical:string}>={};
 for(const row of rows){
  const slug=developmentSlug(row.name),href=slug&&!reserved.has(slug)&&groups.get(slug)?.length===1?`/developments/${slug}`:row.href;
  canonical[row.href]=href;
  destinations[row.href]={source:row.href,canonical:href};
  if(href!==row.href)destinations[href]={source:row.href,canonical:href};
 }
 return {canonical,destinations};
}
