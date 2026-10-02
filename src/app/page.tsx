import {cardImageCollection,reportCardImage} from '../web/card-images';
import logos from '../../public/logos/sources.json';
import {developers,readCollection} from '../web/collections';
import {absoluteUrl,jsonLd} from '../web/seo';
import {readFile} from 'node:fs/promises';
import {DeveloperDirectory,type DeveloperCard} from '../web/directory';
export const metadata={alternates:{canonical:'/'}};
export const dynamic='force-dynamic';
export default async function Home(){
 const cards=await Promise.all(developers.map(async developer=>{
  const report=await readCollection(developer.slug);if(!report?.images.some(i=>i.verdict?.matches))return null;const matches=report?.images.filter(i=>i.categorisation?i.categorisation.isRoom:i.verdict?.matches)??[];const hero=matches[0];if(!hero)return null;
  const locations=await readFile(`collections/${developer.slug}-home-offices/locations.json`,'utf8').then(s=>JSON.parse(s)).catch(()=>[]);
  return {slug:developer.slug,name:developer.name,spaces:matches.length,logo:logos.find(l=>l.slug===developer.slug)?`/logos/${logos.find(l=>l.slug===developer.slug)!.file}`:undefined,
   ...cardImageCollection(matches.map(i=>reportCardImage(developer.slug,i))),locations:locations.filter((p:{latitude?:number;longitude?:number})=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude))} as DeveloperCard;
 }));
 const schema={'@context':'https://schema.org','@type':'WebSite',name:'Showhome Explorer',url:absoluteUrl('/'),description:'UK showhome interiors and home office inspiration'};
 return <main><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(schema)}}/><section className="intro"><h1>Showhome Explorer</h1><p>Discover interiors. Find inspiration.</p></section><DeveloperDirectory cards={cards.filter((c):c is DeveloperCard=>c!==null)}/></main>;
}
