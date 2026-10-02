import {cardImageCollection,reportCardImage} from '../../web/card-images';
import logos from '../../../public/logos/sources.json';
import {developers,readCollection} from '../../web/collections';
import {absoluteUrl,jsonLd} from '../../web/seo';
import {readFile} from 'node:fs/promises';
import {DeveloperDirectory,type DeveloperCard} from '../../web/directory';
export const metadata={title:'Homebuilders | Showhome Explorer',description:'Explore showhome interiors from UK housebuilders.',alternates:{canonical:'/homebuilders'}};
export const dynamic='force-dynamic';
export default async function Homebuilders(){
 const cards=await Promise.all(developers.map(async developer=>{
  const report=await readCollection(developer.slug);if(!report?.images.some(i=>i.verdict?.matches))return null;const matches=report?.images.filter(i=>i.categorisation?(i.categorisation.isRoom||i.categorisation.mainCategory==='Exterior'):i.verdict?.matches)??[];const hero=matches[0];if(!hero)return null;
  const locations=await readFile(`collections/${developer.slug}-home-offices/locations.json`,'utf8').then(s=>JSON.parse(s)).catch(()=>[]);
  const logo=logos.find(l=>l.slug===developer.slug);
  const logoUrl=logo?`/logos/${logo.file}`:undefined;
  const logoBackground=['cala','barratt','david-wilson','robertson-homes','lynch-homes'].includes(developer.slug)?'#163f48':'#fff';
  return {slug:developer.slug,name:developer.name,spaces:matches.length,logo:logoUrl,
   ...cardImageCollection(matches.map(i=>reportCardImage(developer.slug,i)),logoUrl?{src:logoUrl,alt:`${developer.name} logo`,kind:'logo',background:logoBackground}:undefined),locations:locations.filter((p:{latitude?:number;longitude?:number})=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude))} as DeveloperCard;
 }));
 const schema={'@context':'https://schema.org','@type':'CollectionPage',name:'Homebuilders',url:absoluteUrl('/homebuilders'),description:'UK showhome interiors and home office inspiration'};
 return <main><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(schema)}}/><section className="intro"><h1>Homebuilders</h1><p>Explore UK homebuilders and discover their showhome interiors.</p></section><DeveloperDirectory cards={cards.filter((c):c is DeveloperCard=>c!==null)}/></main>;
}
