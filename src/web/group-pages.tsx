import logos from '../../public/logos/sources.json';
import {builderBrand} from './builder-brand';
import {developmentName} from './development-name';
import {DirectoryCountProvider,DirectoryCounts} from './directory-counts';
import {buildingLocationIndex} from './building-locations';
import {BuilderName} from './builder-name';
import {cardImageCollection,buildingCardImageCollection,reportCardImage} from './card-images';
import {SiteDirectory} from './site-directory';
import {siteCards} from './site-cards';
import {notFound,permanentRedirect} from 'next/navigation';
import {groupRoutes} from './group-routes';
import {withFilters,type SearchValues} from './url-query';
import {readGroups,spaceName,type GroupKind} from './groups';
import {GroupCards} from './group-cards';
import {ResultsPage} from './results-page';
const labels:Record<GroupKind,string>={sites:'Developments',locations:'Developments',spaces:'Interiors',interiors:'Interiors',buildings:'Buildings'};
const descriptions:Record<GroupKind,string>={sites:'Explore homebuilder developments by name and discover their published interiors.',locations:'Explore homebuilder developments by name and discover their published interiors.',spaces:'Explore interiors grouped by room and space type.',interiors:'Explore interiors grouped by room and space type.',buildings:'Explore homebuilder house types by name and discover their interiors.'};
function prefixFor(kind:GroupKind):string{if(kind==='sites'||kind==='locations')return 'developments';if(kind==='spaces'||kind==='interiors')return 'interiors';return kind;}
export async function GroupDirectory({kind}:{kind:GroupKind}){
 const groups=await readGroups(kind);const pathPrefix=prefixFor(kind);const routes=groupRoutes(kind,groups);
 if(kind==='sites'||kind==='locations'){
  const cards=await siteCards(groups);
  return <DirectoryCountProvider><main>
   <section className="intro directory-intro" aria-labelledby="locations-heading">
    <div className="directory-intro-heading">
     <h1 id="locations-heading">Developments</h1>
     <p>{descriptions.locations}</p>
     <DirectoryCounts initial={{Developments:cards.length}}/>
    </div>
    <div className="directory-intro-feature">
     <h2>Find inspiration closer to home.</h2>
     <p>Explore the showhomes behind each development—from welcoming kitchens to restful bedrooms. Discover developments near you, compare their interiors, and save ideas for your own home.</p>
    </div>
   </section>
   <SiteDirectory cards={cards} basePath="/developments" defaultView="compact"/>
  </main></DirectoryCountProvider>;
 }
 const geography=await buildingLocationIndex(groups);
 const cards=groups.map(group=>{const properties=group.collections.flatMap(c=>c.report.properties??[]);const bedrooms=[...new Set(properties.map(p=>p.bedrooms).filter((b):b is number=>typeof b==='number'&&Number.isFinite(b)))].sort((a,b)=>a-b);const sites=[...new Set(properties.map(p=>p.development?developmentName(p.development):undefined).filter((d):d is string=>Boolean(d)))].sort();const places=group.collections.flatMap(c=>c.report.properties.map(p=>({site:developmentName(p.development),siteId:`${c.slug}:${p.developmentUrl}`,imageIds:c.report.images.filter(image=>p.imageIds.includes(image.id)&&(image.categorisation?image.categorisation.isRoom:Boolean(image.verdict?.matches)&&spaceName(image,c.report.question)!=='Exterior')).map(image=>`${c.slug}:${image.id}`),developer:c.name,bedrooms:p.bedrooms,locations:geography.get(`${c.slug}:${p.developmentUrl}`)??[]})));const locations=[...new Set(places.flatMap(p=>p.locations))].sort();return {key:group.key,href:routes.get(group.key)!,name:group.name,interiorIds:group.collections.flatMap(c=>c.report.images.filter(image=>image.categorisation?image.categorisation.isRoom:Boolean(image.verdict?.matches)&&spaceName(image,c.report.question)!=='Exterior').map(image=>`${c.slug}:${image.id}`)),developers:[...new Set(group.developers)],count:group.count,...(kind==='buildings'?buildingCardImageCollection:cardImageCollection)(group.collections.flatMap(c=>c.report.images.map(i=>reportCardImage(c.slug,i)))),bedrooms,locations,sites,places};});
 const isBuildings=kind==='buildings';
 const locationCount=new Set(groups.flatMap(group=>group.collections.flatMap(c=>c.report.properties.filter(p=>p.developmentUrl).map(p=>`${c.slug}:${p.developmentUrl}`)))).size;
 const roomGroups=groups.filter(group=>!['Exterior','Uncategorised'].includes(group.name));
 const interiorCount=new Set(roomGroups.flatMap(group=>group.collections.flatMap(c=>c.report.images.filter(image=>image.categorisation?image.categorisation.isRoom:Boolean(image.verdict?.matches)&&spaceName(image,c.report.question)!=='Exterior').map(image=>`${c.slug}:${image.id}`)))).size;
 return <DirectoryCountProvider><main>
  <section className="intro directory-intro" aria-labelledby="directory-heading">
   <div className="directory-intro-heading">
    <h1 id="directory-heading">{labels[kind]}</h1><p>{descriptions[kind]}</p>
    <DirectoryCounts initial={isBuildings?{Styles:groups.length,Developments:locationCount}:{'Room types':roomGroups.length,Interiors:interiorCount}}/>
   </div>
   <div className="directory-intro-feature">
    <h2>{isBuildings?'Discover the home behind the rooms.':'Find ideas for every room.'}</h2>
    <p>{isBuildings?'Explore house styles from UK builders and see how their spaces come together. Compare layouts through their showhome photography and discover the developments behind each home.':'From welcoming kitchens to restful bedrooms, explore showhome inspiration by room type. Compare colours, finishes and furnishings, and save your favourite ideas for your own home.'}</p>
   </div>
  </section>
  <GroupCards cards={cards} pathPrefix={pathPrefix} kindLabel={labels[kind]}/>
 </main></DirectoryCountProvider>;
}
async function findGroup(kind:GroupKind,id:string){
 const groups=await readGroups(kind),routes=groupRoutes(kind,groups),prefix=prefixFor(kind);
 const group=groups.find(g=>g.key===id||routes.get(g.key)===`/${prefix}/${id}`);
 if(!group)notFound();
 return {group,path:routes.get(group.key)!};
}
export async function GroupDetail({kind,id,searchParams={}}:{kind:GroupKind;id:string;searchParams?:SearchValues}){
 const {group,path}=await findGroup(kind,id);const pathPrefix=prefixFor(kind);
 if(path!==`/${pathPrefix}/${id}`)permanentRedirect(withFilters(path,searchParams));
 const places=Object.fromEntries(await buildingLocationIndex([group]));
 const isDevelopment=kind==='sites'||kind==='locations';
 const builder=group.collections[0]!;
 const logo=isDevelopment?logos.find(logo=>logo.slug===builder.slug):undefined;
 return <ResultsPage title={group.name} titleAccessory={logo?<img className="development-title-logo" src={`/logos/${logo.file}`} alt={`${builder.name} logo`} style={{background:builderBrand(builder.slug)?.logoBackground??'#fff'}}/>:undefined} eyebrow={isDevelopment?null:group.developers.map((name,i)=><span key={name}>{i>0?' · ':''}<BuilderName name={name}/></span>)} description={`Explore interiors from ${group.name}. Discover the homes and developments behind each image.`} back={{href:`/${pathPrefix}`,label:`← All ${labels[kind].toLowerCase()}`}} collections={group.collections} places={places} initialImage={kind==='buildings' && typeof searchParams.image==='string' ? searchParams.image : undefined} includeUnclassified/>;
}
export async function groupMetadata(kind:GroupKind,id:string){const {group,path}=await findGroup(kind,id);return {title:`${group.name} | Showhome Explorer`,description:`Explore ${group.count} images from ${group.name} by ${group.developers.join(', ')}.`,alternates:{canonical:path}};}
