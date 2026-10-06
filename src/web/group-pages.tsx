import {CardImage} from './card-image';
import {cachedGallery as queryGallery} from '../database/gallery-cache';
import {cachedDirectory as queryDirectory} from '../database/directory-cache';
import {readDirectoryCards,readPresentation,findDirectoryReference,readWebsiteCollection,readWebsiteBuilder} from '../database/website';
import type {SiteCard} from './site-filters';
import type {GroupCardItem} from './group-cards';
import {directoryPreview,directoryIdentityEncoder,compactDirectoryPlaces} from './directory-payload';
import {developmentNavigationImages} from './development-navigation-images';
import Link from 'next/link';
import {readDevelopmentContact} from './read-development-contact';
import {DevelopmentOverviewDetails} from './development-overview-details';
import {DevelopmentDirectoryMap} from './development-directory-map';
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
import {groupCollections,readGroups,spaceName,type GroupKind} from './groups';
import {GroupCards} from './group-cards';
import {ResultsPage} from './results-page';
const labels:Record<GroupKind,string>={sites:'Developments',locations:'Developments',spaces:'Interiors',interiors:'Interiors',buildings:'Buildings'};
const descriptions:Record<GroupKind,string>={sites:'Explore homebuilder developments by name and discover their published interiors.',locations:'Explore homebuilder developments by name and discover their published interiors.',spaces:'Explore interiors grouped by room and space type.',interiors:'Explore interiors grouped by room and space type.',buildings:'Explore homebuilder house types by name and discover their interiors.'};
function prefixFor(kind:GroupKind):string{if(kind==='sites'||kind==='locations')return 'developments';if(kind==='spaces'||kind==='interiors')return 'interiors';return kind;}
export async function GroupDirectory({kind}:{kind:GroupKind}){
 const normalized=kind==='sites'?'locations':kind==='spaces'?'interiors':kind;
 const pathPrefix=prefixFor(kind),isBuildings=kind==='buildings';
 const initial=await queryDirectory({kind:normalized}),counts=initial.counts;
 if(normalized==='locations'){
  const cards=initial.cards as SiteCard[];
  return <DirectoryCountProvider><main>
   <section className="intro directory-intro development-directory-intro" aria-labelledby="locations-heading">
    <div className="directory-intro-heading">
     <h1 id="locations-heading">Developments</h1>
     <p>{descriptions.locations}</p>
     <DirectoryCounts initial={counts}/>
    </div>
    <DevelopmentDirectoryMap initialCards={initial.mapCards??[]}/>
   </section>
   <SiteDirectory cards={cards} initial={initial} basePath="/developments" defaultView="compact"/>
  </main></DirectoryCountProvider>;
 }
 const cards=initial.cards as GroupCardItem[];
 return <DirectoryCountProvider><main>
  <section className="intro directory-intro" aria-labelledby="directory-heading">
   <div className="directory-intro-heading">
    <h1 id="directory-heading">{labels[kind]}</h1><p>{descriptions[kind]}</p>
    <DirectoryCounts initial={counts}/>
   </div>
   <div className="directory-intro-feature">
    <h2>{isBuildings?'Discover the home behind the rooms.':'Find ideas for every room.'}</h2>
    <p>{isBuildings?'Explore house styles from UK builders and see how their spaces come together. Compare layouts through their showhome photography and discover the developments behind each home.':'From welcoming kitchens to restful bedrooms, explore showhome inspiration by room type. Compare colours, finishes and furnishings, and save your favourite ideas for your own home.'}</p>
   </div>
  </section>
  <GroupCards cards={cards} initial={initial} pathPrefix={pathPrefix} kindLabel={labels[kind]}/>
 </main></DirectoryCountProvider>;
}
async function findGroup(kind:GroupKind,id:string){
 const normalized=kind==='sites'?'locations':kind==='spaces'?'interiors':kind;
 const reference=await findDirectoryReference(normalized,`/${prefixFor(kind)}/${id}`);
 if(!reference)notFound();
 const collections=(await Promise.all(reference.collection_slugs.map(async(slug:string)=>{
  const report=await readWebsiteCollection(slug,{developmentUrl:reference.development_url??undefined,buildingName:reference.building_name??undefined,category:reference.category??undefined});
  return report?{slug,name:report.builder!.name,report}:null;
 }))).filter(c=>c!==null);
 const group=groupCollections(collections,kind).find(g=>g.key===reference.key);
 if(!group)notFound();
 return {group,path:reference.href};
}
export async function GroupDetail({kind,id,searchParams={}}:{kind:GroupKind;id:string;searchParams?:SearchValues}){
 const pathPrefix=prefixFor(kind);
 if(kind==='buildings'||kind==='interiors'||kind==='spaces'){
  const galleryScope={kind:kind==='buildings'?'buildings' as const:'interiors' as const,href:`/${pathPrefix}/${id}`};
  const reference=await findDirectoryReference(galleryScope.kind,galleryScope.href);if(!reference)notFound();
  const galleryPage=await queryGallery({scope:galleryScope,...(typeof searchParams.image==='string'?{selectedUid:searchParams.image}:{})});
  return <ResultsPage title={reference.name} eyebrow={reference.payload.developers?.join(' · ')} description={`Explore interiors from ${reference.name}. Discover the homes and developments behind each image.`} back={{href:`/${pathPrefix}`,label:`← All ${labels[kind].toLowerCase()}`}} collections={[]} places={{}} galleryScope={galleryScope} galleryPage={galleryPage} initialImage={typeof searchParams.image==='string'?searchParams.image:undefined} includeUnclassified/>;
 }
 const {group,path}=await findGroup(kind,id);
 if(path!==`/${pathPrefix}/${id}`)permanentRedirect(withFilters(path,searchParams));
 const places=Object.fromEntries(await buildingLocationIndex([group]));
 const isDevelopment=kind==='sites'||kind==='locations';
 const detailCard=isDevelopment?(await siteCards([group]))[0]:undefined;
 const contact=isDevelopment&&group.developmentUrl?await readDevelopmentContact(group.developmentUrl):undefined;
 const developmentCounts=isDevelopment?{'Building Types':groupCollections(group.collections,'buildings').filter(group=>group.name!=='Development gallery').length,'Room Types':groupCollections(group.collections,'interiors').filter(group=>!['Exterior','Uncategorised'].includes(group.name)).length,Interiors:new Set(group.collections.flatMap(collection=>collection.report.images.filter(image=>image.categorisation?image.categorisation.isRoom:Boolean(image.verdict?.matches)&&spaceName(image,collection.report.question)!=='Exterior').map(image=>`${collection.slug}:${image.id}`))).size}:undefined;
 const builder=group.collections[0]!;
 const brand=isDevelopment?await readWebsiteBuilder(builder.slug):undefined;
 const logo=brand?.logo_url;
 const {exterior,interior}=developmentNavigationImages(group.collections,builder.slug,group.developmentUrl);
 const navigation=isDevelopment?<>
  <div className="results-heading development-explore-heading"><h2>Explore the development</h2></div>
  <nav className="builder-navigation" aria-label={`Explore ${group.name}`}>
   <Link className="builder-navigation-card" href={`/builders/${builder.slug}`}>
    {logo?<CardImage src={logo} alt="" style={{objectFit:'contain',padding:24,background:brand?.logo_background??'#fff'}}/>:<div className="builder-navigation-placeholder">{builder.name}</div>}
    <div className="builder-navigation-content"><h2>View Builder<span aria-hidden="true">→</span></h2><p>{builder.name}</p></div>
   </Link>
   {[{path:'buildings',label:'View Building Types',count:developmentCounts?.['Building Types']??0,unit:'building types',preview:exterior},{path:'interiors',label:'View Interiors',count:developmentCounts?.Interiors??0,unit:'interiors',preview:interior}].map(destination=><Link key={destination.path} className="builder-navigation-card" href={`/${destination.path}`} data-filters={JSON.stringify({developer:builder.name,site:group.name})}>
    {destination.preview?<CardImage src={`/api/assets/${destination.preview.slug}/${destination.preview.image.path.split('/').map(encodeURIComponent).join('/')}`} alt="" loading="lazy"/>:<div className="builder-navigation-placeholder">{group.name}</div>}
    <div className="builder-navigation-content"><h2>{destination.label}<span aria-hidden="true">→</span></h2><p>{destination.count.toLocaleString('en-GB')} {destination.unit}</p></div>
   </Link>)}
  </nav>
 </>:undefined;

 return <ResultsPage title={group.name} counts={developmentCounts} developmentDetails={detailCard?<DevelopmentOverviewDetails card={detailCard} contact={contact}/>:undefined} titleAccessory={logo?<img className="builder-results-logo development-builder-overview-logo" src={logo} alt={`${builder.name} logo`} style={{background:brand?.logo_background??'#fff'}}/>:undefined} eyebrow={isDevelopment?null:group.developers.map((name,i)=><span key={name}>{i>0?' · ':''}<BuilderName name={name}/></span>)} description={`Explore interiors from ${group.name}. Discover the homes and developments behind each image.`} back={{href:`/${pathPrefix}`,label:`← All ${labels[kind].toLowerCase()}`}} collections={group.collections} places={places} initialImage={undefined} includeUnclassified>{navigation}</ResultsPage>;
}
export async function groupMetadata(kind:GroupKind,id:string){if(kind==='buildings'||kind==='interiors'||kind==='spaces'){const path=`/${prefixFor(kind)}/${id}`,reference=await findDirectoryReference(kind==='spaces'?'interiors':kind,path);if(!reference)notFound();return {title:`${reference.name} | Showhome Explorer`,description:`Explore ${reference.payload.count} images from ${reference.name}.`,alternates:{canonical:path}};}const {group,path}=await findGroup(kind,id);return {title:`${group.name} | Showhome Explorer`,description:`Explore ${group.count} images from ${group.name} by ${group.developers.join(', ')}.`,alternates:{canonical:path}};}
