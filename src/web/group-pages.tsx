import {SiteDirectory} from './site-directory';
import {siteCards} from './site-cards';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {readGroups,type GroupKind} from './groups';
import {assetUrl} from './collections';
import {Gallery} from './gallery';
const labels={sites:'Sites',spaces:'Spaces',buildings:'Buildings'};
const descriptions={sites:'Explore developer sites by name and discover their published interiors.',spaces:'Explore interiors grouped by room and space type.',buildings:'Explore developer house types by name and discover their interiors.'};
export async function GroupDirectory({kind}:{kind:GroupKind}){
 const groups=await readGroups(kind);
 if(kind==='sites')return <main><section className="intro compact"><h1>Sites</h1><p>{descriptions.sites}</p></section><SiteDirectory cards={await siteCards(groups)}/></main>;
 return <main><section className="intro compact"><h1>{labels[kind]}</h1><p>{descriptions[kind]}</p></section><p className="count">{groups.length} {labels[kind].toLowerCase()}</p><div className="collection-grid">{groups.map(group=>{const collection=group.collections[0]!,hero=collection.report.images[0]!;return <Link className="collection-card" href={`/${kind}/${group.key}`} key={group.key}><img loading="lazy" src={assetUrl(collection.slug,hero.path)} alt={hero.verdict?.description??'Uncategorised interior'}/><div className="card-body"><h2>{group.name}</h2><p className="subtle">{group.developers.join(' · ')}</p><p>{group.count} {group.count===1?'image':'images'}</p><span className="subtle">Explore collection →</span></div></Link>;})}</div>{!groups.length&&<p className="empty">No spaces available yet.</p>}</main>;
}
export async function GroupDetail({kind,id}:{kind:GroupKind;id:string}){
 const group=(await readGroups(kind)).find(g=>g.key===id);if(!group)notFound();
 return <main><section className="intro compact"><Link href={`/${kind}`}>← All {labels[kind].toLowerCase()}</Link><h1>{group.name}</h1><p>{group.developers.join(' · ')}</p></section><Gallery collections={group.collections} includeUnclassified/></main>;
}
export async function groupMetadata(kind:GroupKind,id:string){const group=(await readGroups(kind)).find(g=>g.key===id);if(!group)notFound();return {title:`${group.name} | Showhome Explorer`,description:`Explore ${group.count} images from ${group.name} by ${group.developers.join(', ')}.`,alternates:{canonical:`/${kind}/${id}`}};}
