import {BuildingOverviewDetails,buildingDevelopmentPreviews} from './building-overview-details';
import {optimizedImageSource} from './optimized-image-source';
import {publicDevelopmentCards} from '../database/development-public-routes';
import {DevelopmentDirectoryBuilderLogo} from './development-directory-builder-logo';
import {searchListing} from './seo';
import {homeTypeName} from '../reports/home-display';
import {roomLabel,roomCollectionLabel} from './shared-image-cards';
import {CardImage,NextCardImage} from './card-image';
import {cachedGallery as queryGallery} from '../database/gallery-cache';
import {cachedDirectory as queryDirectory} from '../database/directory-cache';
import {readBuilderLogos,readDirectoryCards,readPresentation,findDirectoryReference,readWebsiteCollection,readWebsiteBuilder} from '../database/website';
import type {DirectoryPageData} from './directory-page-data';
import type {SiteCard} from './site-filters';
import type {GroupCardItem} from './group-cards';
import {directoryPreview,directoryIdentityEncoder,compactDirectoryPlaces} from './directory-payload';
import {developmentNavigationImages} from './development-navigation-images';
import Link from 'next/link';
import {readDevelopmentContact} from './read-development-contact';
import {DevelopmentOverviewDetails} from './development-overview-details';
import {DevelopmentArea,readDevelopmentArea} from './development-area';
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
const descriptions:Record<GroupKind,string>={sites:'Explore homebuilder developments by name and discover their published interiors.',locations:'Explore homebuilder developments by name and discover their published interiors.',spaces:'Explore interiors grouped by room and space type.',interiors:'Explore showhome interiors by room and find ideas for your home.',buildings:'Explore homebuilder house types by name and discover their interiors.'};
function prefixFor(kind:GroupKind):string{if(kind==='sites'||kind==='locations')return 'developments';if(kind==='spaces'||kind==='interiors')return 'interiors';return kind;}
export async function GroupDirectory({kind,initial:provided,title,description,linkBase}:{kind:GroupKind;initial?:DirectoryPageData;title?:string;description?:string;linkBase?:string}){
 const normalized=kind==='sites'?'locations':kind==='spaces'?'interiors':kind;
 const pathPrefix=prefixFor(kind),isBuildings=kind==='buildings';
 // Render cached default results in the initial HTML; session criteria apply after hydration.
 const published=provided??await queryDirectory({kind:normalized});
 const initial=normalized==='locations'?await publicDevelopmentCards(published):published,counts=initial.counts;
 if(normalized==='locations'){
  const cards=initial.cards as SiteCard[],logos=await readBuilderLogos();
  return <DirectoryCountProvider><main>
   <section className="intro directory-intro development-directory-intro" aria-labelledby="locations-heading">
    <div className="directory-intro-heading">
     <div className="development-directory-title-row"><h1 id="locations-heading">{title??'Developments'}</h1><DevelopmentDirectoryBuilderLogo logos={logos}/></div>
     <p>{description??descriptions.locations}</p>
     <DirectoryCounts initial={counts}/>
    </div>
    <DevelopmentDirectoryMap initialCards={initial.mapCards??[]}/>
   </section>
   <SiteDirectory cards={cards} initial={initial} basePath="/developments" defaultView="compact"/>
  </main></DirectoryCountProvider>;
 }
 const cards=initial.cards as GroupCardItem[];
 return <DirectoryCountProvider><main>
  <section className={`intro directory-intro${isBuildings?' buildings-directory-intro':' interiors-directory-intro'}`} aria-labelledby="directory-heading">
   <div className="directory-intro-heading">
    <h1 id="directory-heading">{title??labels[kind]}</h1><p>{description??descriptions[kind]}</p>
    <DirectoryCounts initial={counts}/>
   </div>
   <div className="directory-intro-feature">
    <h2>{isBuildings?'Discover the home behind the rooms.':'Find ideas for every room.'}</h2>
    <p>{isBuildings?'Explore house styles from UK builders and see how their spaces come together. Compare layouts through their showhome photography and discover the developments behind each home.':'From welcoming kitchens to restful bedrooms, explore showhome inspiration by room type. Compare colours, finishes and furnishings, and save your favourite ideas for your own home.'}</p>
   </div>
  </section>
  <GroupCards cards={cards} initial={initial} pathPrefix={pathPrefix} linkBase={linkBase} kindLabel={labels[kind]}/>
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
export async function GroupDetail({kind,id,searchParams={},canonicalPath}:{kind:GroupKind;id:string;searchParams?:SearchValues;canonicalPath?:string}){
 const pathPrefix=prefixFor(kind);
 if(kind==='buildings'||kind==='interiors'||kind==='spaces'){
  const isAll=(kind==='interiors'||kind==='spaces')&&id==='all';
  const galleryScope={kind:kind==='buildings'?'buildings' as const:'interiors' as const,href:`/${pathPrefix}/${id}`};
  const reference=isAll?{key:'all',name:'All Room Types',payload:{count:0,developers:[]}}:await findDirectoryReference(galleryScope.kind,galleryScope.href);
  if(!reference)notFound();
  const galleryPage=await queryGallery({scope:galleryScope,...(typeof searchParams.image==='string'?{selectedUid:searchParams.image}:{})});
  if(galleryScope.kind==='buildings'&&!galleryPage.total)notFound();
  const brand=kind==='buildings'?await readWebsiteBuilder(reference.collection_slugs[0]):undefined;
  return <ResultsPage buildingDetails={kind==='buildings'?<BuildingOverviewDetails slugs={reference.collection_slugs} name={reference.building_name??reference.name}/>:undefined} titleAccessory={brand?.logo_url?<img className="builder-results-logo development-builder-overview-logo" src={brand.logo_url} alt={`${brand.name} logo`} style={{background:brand.logo_background??'#fff'}}/>:undefined} buildingDevelopments={kind==='buildings'?await buildingDevelopmentPreviews(reference.collection_slugs,reference.building_name??reference.name):undefined} title={kind==='buildings'?homeTypeName(reference.name):roomCollectionLabel(reference.name)} eyebrow={kind==='interiors'||kind==='spaces'?null:reference.payload.developers?.join(' · ')} description={isAll?'Explore showhome inspiration across all room types. Discover the homes and developments behind each image.':`Explore interiors from ${kind==='buildings'?homeTypeName(reference.name):roomLabel(reference.name)}. Discover the homes and developments behind each image.`} back={{href:`/${pathPrefix}`,label:`← All ${labels[kind].toLowerCase()}`}} collections={[]} places={{}} galleryScope={galleryScope} galleryPage={galleryPage} initialImage={typeof searchParams.image==='string'?searchParams.image:undefined} includeUnclassified/>;
 }
 const {group,path}=await findGroup(kind,id);
 if(!canonicalPath&&path!==`/${pathPrefix}/${id}`)permanentRedirect(withFilters(path,searchParams));
 const isDevelopment=kind==='sites'||kind==='locations';
 const builder=group.collections[0]!;
 const [placeEntries,detailCards,contact,brand,area]=await Promise.all([
  buildingLocationIndex([group]),
  isDevelopment?siteCards([group]):Promise.resolve([]),
  isDevelopment&&group.developmentUrl?readDevelopmentContact(group.developmentUrl):Promise.resolve(undefined),
  isDevelopment?readWebsiteBuilder(builder.slug):Promise.resolve(undefined),
  isDevelopment&&group.developmentUrl?readDevelopmentArea(builder.slug,group.developmentUrl):Promise.resolve(undefined)
 ]);
 const places=Object.fromEntries(placeEntries),detailCard=detailCards[0];
 const developmentCounts=isDevelopment?{'Building Types':groupCollections(group.collections,'buildings').filter(group=>group.name!=='Development gallery').length,'Room Types':groupCollections(group.collections,'interiors').filter(group=>!['Exterior','Uncategorised'].includes(group.name)).length,Interiors:new Set(group.collections.flatMap(collection=>collection.report.images.filter(image=>image.categorisation?image.categorisation.isRoom:Boolean(image.verdict?.matches)&&spaceName(image,collection.report.question)!=='Exterior').map(image=>`${collection.slug}:${image.id}`))).size}:undefined;
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
    {destination.preview?<NextCardImage src={optimizedImageSource(`/api/assets/${destination.preview.slug}/${destination.preview.image.path.split('/').map(encodeURIComponent).join('/')}`)} alt="" width={640} height={480} sizes="(max-width: 700px) 100vw, 33vw" loading="lazy"/>:<div className="builder-navigation-placeholder">{group.name}</div>}
    <div className="builder-navigation-content"><h2>{destination.label}<span aria-hidden="true">→</span></h2><p>{destination.count.toLocaleString('en-GB')} {destination.unit}</p></div>
   </Link>)}
  </nav>
  <DevelopmentArea area={area}/>
 </>:undefined;

 return <ResultsPage title={group.name} counts={developmentCounts} developmentDetails={detailCard?<DevelopmentOverviewDetails card={detailCard} contact={contact} facts={brand?.facts}/>:undefined} titleAccessory={logo?<img className="builder-results-logo development-builder-overview-logo" src={logo} alt={`${builder.name} logo`} style={{background:brand?.logo_background??'#fff'}}/>:undefined} eyebrow={isDevelopment||kind==='interiors'||kind==='spaces'?null:group.developers.map((name,i)=><span key={name}>{i>0?' · ':''}<BuilderName name={name}/></span>)} description={`Explore interiors from ${group.name}. Discover the homes and developments behind each image.`} back={{href:`/${pathPrefix}`,label:`← All ${labels[kind].toLowerCase()}`}} collections={group.collections} places={places} initialImage={undefined} includeUnclassified>{navigation}</ResultsPage>;
}
export async function groupMetadata(kind:GroupKind,id:string,canonicalPath?:string){
 const sourcePath=`/${prefixFor(kind)}/${id}`;
 const path=canonicalPath??sourcePath;
 const isInterior=kind==='interiors'||kind==='spaces';
 const isAll=isInterior&&id==='all';
 if(isAll)return searchListing('Showhome Interiors & Room Ideas','Explore real showhome interiors across kitchens, bedrooms, living rooms and more. Compare colours, furnishings and features for your own home.',path);
 const reference=await findDirectoryReference(kind==='spaces'?'interiors':kind==='sites'?'locations':kind,sourcePath);
 if(!reference)notFound();
 const card=reference.payload;
 if(kind==='buildings'){
  const name=homeTypeName(reference.name),builder=(card.developers??[])[0];
  return searchListing(`${name}${builder?` by ${builder}`:''} | House Type & Interiors`,`Explore ${name}${builder?` by ${builder}`:''}. View house exterior photographs, floorplans where available and showhome interiors to compare layouts and room ideas.`,path);
 }
 if(isInterior){
  const name=roomLabel(reference.name);
  return searchListing(`${name} Ideas | Showhome Interiors`,`Explore ${name.toLowerCase()} photographs from UK showhomes. Compare colours, furnishings and interior features, and save ideas for your own home.`,path);
 }
 const name=developmentName(reference.name),location=[card.town,card.country].filter(Boolean).join(', '),builder=card.developer;
 return searchListing(`${name}${builder?` by ${builder}`:''} | New Homes`, `Explore ${name}${location?` in ${location}`:''}${builder?` by ${builder}`:''}. Discover building types and showhome interiors, and compare ideas for your next home.`,path);
}
