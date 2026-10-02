import {SiteDirectory} from './site-directory';
import {siteCards} from './site-cards';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {readGroups,type GroupKind} from './groups';
import {assetUrl} from './collections';
import {Gallery} from './gallery';
const labels:Record<GroupKind,string>={sites:'Locations',locations:'Locations',spaces:'Interiors',interiors:'Interiors',buildings:'Buildings'};
const descriptions:Record<GroupKind,string>={sites:'Explore homebuilder locations by name and discover their published interiors.',locations:'Explore homebuilder locations by name and discover their published interiors.',spaces:'Explore interiors grouped by room and space type.',interiors:'Explore interiors grouped by room and space type.',buildings:'Explore homebuilder house types by name and discover their interiors.'};
function prefixFor(kind:GroupKind):string{if(kind==='sites'||kind==='locations')return 'locations';if(kind==='spaces'||kind==='interiors')return 'interiors';return kind;}
export async function GroupDirectory({kind}:{kind:GroupKind}){
 const groups=await readGroups(kind);const pathPrefix=prefixFor(kind);
 if(kind==='sites'||kind==='locations')return <main><section className="intro compact"><h1>Locations</h1><p>{descriptions.locations}</p></section><SiteDirectory cards={await siteCards(groups)} basePath="/locations"/></main>;
 return <main><section className="intro compact"><h1>{labels[kind]}</h1><p>{descriptions[kind]}</p></section><p className="count">{groups.length} {labels[kind].toLowerCase()}</p><div className="collection-grid">{groups.map(group=>{const collection=group.collections[0]!,hero=collection.report.images[0]!;return <Link className="collection-card" href={`/${pathPrefix}/${group.key}`} key={group.key}><img loading="lazy" src={assetUrl(collection.slug,hero.path)} alt={hero.verdict?.description??'Uncategorised interior'}/><div className="card-body"><h2>{group.name}</h2><p className="subtle">{group.developers.join(' · ')}</p><p>{group.count} {group.count===1?'image':'images'}</p><span className="subtle">Explore collection →</span></div></Link>;})}</div>{!groups.length&&<p className="empty">No interiors available yet.</p>}</main>;
}
export async function GroupDetail({kind,id}:{kind:GroupKind;id:string}){
 const group=(await readGroups(kind)).find(g=>g.key===id);if(!group)notFound();const pathPrefix=prefixFor(kind);
 return <main><section className="intro compact"><Link href={`/${pathPrefix}`}>← All {labels[kind].toLowerCase()}</Link><h1>{group.name}</h1><p>{group.developers.join(' · ')}</p></section><Gallery collections={group.collections} includeUnclassified/></main>;
}
export async function groupMetadata(kind:GroupKind,id:string){const group=(await readGroups(kind)).find(g=>g.key===id);if(!group)notFound();const pathPrefix=prefixFor(kind);return {title:`${group.name} | Showhome Explorer`,description:`Explore ${group.count} images from ${group.name} by ${group.developers.join(', ')}.`,alternates:{canonical:`/${pathPrefix}/${id}`}};}

