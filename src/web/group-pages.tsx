import {buildingLocationIndex} from './building-locations';
import {BuilderName} from './builder-name';
import {cardImageCollection,buildingCardImageCollection,reportCardImage} from './card-images';
import {SiteDirectory} from './site-directory';
import {siteCards} from './site-cards';
import {notFound,permanentRedirect} from 'next/navigation';
import {groupRoutes} from './group-routes';
import {withFilters,type SearchValues} from './url-query';
import {readGroups,type GroupKind} from './groups';
import {GroupCards} from './group-cards';
import {ResultsPage} from './results-page';
const labels:Record<GroupKind,string>={sites:'Locations',locations:'Locations',spaces:'Interiors',interiors:'Interiors',buildings:'Buildings'};
const descriptions:Record<GroupKind,string>={sites:'Explore homebuilder locations by name and discover their published interiors.',locations:'Explore homebuilder locations by name and discover their published interiors.',spaces:'Explore interiors grouped by room and space type.',interiors:'Explore interiors grouped by room and space type.',buildings:'Explore homebuilder house types by name and discover their interiors.'};
function prefixFor(kind:GroupKind):string{if(kind==='sites'||kind==='locations')return 'locations';if(kind==='spaces'||kind==='interiors')return 'interiors';return kind;}
export async function GroupDirectory({kind}:{kind:GroupKind}){
 const groups=await readGroups(kind);const pathPrefix=prefixFor(kind);const routes=groupRoutes(kind,groups);
 if(kind==='sites'||kind==='locations')return <main><section className="intro compact"><h1>Locations</h1><p>{descriptions.locations}</p></section><SiteDirectory cards={await siteCards(groups)} basePath="/locations"/></main>;
 const geography=kind==='buildings'?await buildingLocationIndex(groups):new Map<string,string[]>();
 const cards=groups.map(group=>{const properties=group.collections.flatMap(c=>c.report.properties??[]);const bedrooms=[...new Set(properties.map(p=>p.bedrooms).filter((b):b is number=>typeof b==='number'&&Number.isFinite(b)))].sort((a,b)=>a-b);const sites=[...new Set(properties.map(p=>p.development?.trim()).filter((d):d is string=>Boolean(d)))].sort();const places=group.collections.flatMap(c=>c.report.properties.map(p=>({site:p.development,locations:geography.get(`${c.slug}:${p.developmentUrl}`)??[]})));const locations=[...new Set(places.flatMap(p=>p.locations))].sort();return {key:group.key,href:routes.get(group.key)!,name:group.name,developers:[...new Set(group.developers)],count:group.count,...(kind==='buildings'?buildingCardImageCollection:cardImageCollection)(group.collections.flatMap(c=>c.report.images.map(i=>reportCardImage(c.slug,i)))),bedrooms,locations,sites,places};});
 return <main><section className="intro compact"><h1>{labels[kind]}</h1><p>{descriptions[kind]}</p></section><GroupCards cards={cards} pathPrefix={pathPrefix} kindLabel={labels[kind]}/></main>;
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
 const places=kind==='buildings'?Object.fromEntries(await buildingLocationIndex([group])):undefined;
 return <ResultsPage title={group.name} eyebrow={group.developers.map((name,i)=><span key={name}>{i>0?' · ':''}<BuilderName name={name}/></span>)} description={`Explore interiors from ${group.name}. Discover the homes and developments behind each image.`} back={{href:withFilters(`/${pathPrefix}`,Object.fromEntries(Object.entries(searchParams).filter(([key])=>['developer','bedrooms','location','site','country','minPrice','maxPrice','minBeds','maxBeds','style','radius','postcode','order'].includes(key)))),label:`← All ${labels[kind].toLowerCase()}`}} collections={group.collections} places={places} includeUnclassified/>;
}
export async function groupMetadata(kind:GroupKind,id:string){const {group,path}=await findGroup(kind,id);return {title:`${group.name} | Showhome Explorer`,description:`Explore ${group.count} images from ${group.name} by ${group.developers.join(', ')}.`,alternates:{canonical:path}};}
