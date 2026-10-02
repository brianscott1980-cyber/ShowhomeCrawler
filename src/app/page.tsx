import {assetUrl,developers,readCollection} from '../web/collections';
import {readFile} from 'node:fs/promises';
import {DeveloperDirectory,type DeveloperCard} from '../web/directory';
export const dynamic='force-dynamic';
export default async function Home(){
 const cards=await Promise.all(developers.map(async developer=>{
  const report=await readCollection(developer.slug);const matches=report?.images.filter(i=>i.verdict?.matches)??[];const hero=matches[0];if(!hero)return null;
  const locations=await readFile(`collections/${developer.slug}-home-offices/locations.json`,'utf8').then(s=>JSON.parse(s)).catch(()=>[]);
  return {slug:developer.slug,name:developer.name,spaces:matches.length,image:assetUrl(developer.slug,hero.path),description:hero.verdict?.description??'Showhome interior',locations:locations.filter((p:{latitude?:number;longitude?:number})=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude))} as DeveloperCard;
 }));
 return <main><section className="intro"><h1>Showhome Explorer</h1><p>Discover interiors. Find inspiration.</p></section><DeveloperDirectory cards={cards.filter((c):c is DeveloperCard=>c!==null)}/></main>;
}
