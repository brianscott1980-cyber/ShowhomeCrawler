'use client';
import {useState} from 'react';
import Link from 'next/link';
import type {Furnishing} from '../database/furnishings';
import {CardResults} from './card-results';
import {NextCardImage} from './card-image';
import {optimizedImageSource} from './optimized-image-source';
import {ViewOptions,useCardView} from './view-options';
import {SingleSelectFilter} from './single-select-filter';
export function FurnishingCards({items}:{items:Furnishing[]}){
 const [view,changeView]=useCardView('showhome-furnishings-view','compact'),[order,setOrder]=useState('name');
 const cards=order==='name-desc'?[...items].reverse():items;
 return <><div className="directory-toolbar furnishings-directory-toolbar"><div className="directory-view-status"><ViewOptions view={view} onChange={changeView}/></div><div className="sort-control"><span>Order By</span><SingleSelectFilter label="Order Furnishings By" value={order} options={[{value:'name',label:'Name Asc'},{value:'name-desc',label:'Name Desc'}]} onChange={setOrder}/></div></div><CardResults className={`collection-grid directory-${view}`} label="Furnishings" identity={order}>{cards.map(item=><Link prefetch={false} className="collection-card" key={item.slug} href={`/furnishings/${item.slug}`}><div className="site-preview-photo group-preview-photo"><NextCardImage src={optimizedImageSource(item.image)} alt={`${item.name} in a showhome interior`} width={640} height={480} sizes="(max-width: 700px) 100vw, 33vw" loading="lazy"/></div><div className="card-body"><h2>{item.name}</h2><p>{item.count} {item.count===1?'Interior':'Interiors'}</p></div></Link>)}</CardResults></>;
}
