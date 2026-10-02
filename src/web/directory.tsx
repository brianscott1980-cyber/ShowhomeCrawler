'use client';
import {BuilderName} from './builder-name';
import {useState} from 'react';
import {ScrollCollectionImage,type CollectionImage} from './scroll-collection-image';
import {ViewOptions,useCardView,type CardViewMode} from './view-options';
export interface Point {latitude:number;longitude:number}
export interface DeveloperCard {slug:string;name:string;spaces:number;image:string;description:string;logo?:string;images?:CollectionImage[];locations:(Point&{name:string})[]}
export function distanceMiles(a:Point,b:Point){const rad=(n:number)=>n*Math.PI/180;const dlat=rad(b.latitude-a.latitude),dlon=rad(b.longitude-a.longitude);const h=Math.sin(dlat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dlon/2)**2;return 3958.7613*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
export function orderedDevelopers(cards:DeveloperCard[],sort:string,point:Point|null){return cards.map(card=>({...card,nearest:point?card.locations.map(location=>({...location,miles:distanceMiles(point,location)})).sort((a,b)=>a.miles-b.miles)[0]:undefined})).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='distance'&&point?(a.nearest?.miles??Infinity)-(b.nearest?.miles??Infinity)||a.name.localeCompare(b.name):b.spaces-a.spaces||a.name.localeCompare(b.name));}
export function DeveloperDirectory({
 cards,
 defaultView = 'list',
 storageKey = 'showhome-homebuilders-view',
}:{
 cards:DeveloperCard[];
 defaultView?: CardViewMode;
 storageKey?: string;
}){
 const [view,changeView]=useCardView(storageKey,defaultView);const [sort,setSort]=useState('name');const [postcode,setPostcode]=useState('');const [point,setPoint]=useState<Point|null>(null);const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 async function locatePostcode(e:React.FormEvent){e.preventDefault();if(busy)return;setPoint(null);setBusy(true);setMessage('Looking up postcode…');try{const response=await fetch('/api/location?postcode='+encodeURIComponent(postcode.trim()));const data=await response.json();if(!response.ok)throw new Error(data.error??'Postcode lookup failed.');setPoint(data);setSort('distance');setMessage('Distances from '+data.postcode);}catch(error){setMessage(error instanceof Error?error.message:'Postcode lookup failed.');}finally{setBusy(false);}}
 function locateBrowser(){if(busy)return;if(!navigator.geolocation){setMessage('Location lookup is unavailable. Enter a postcode instead.');return;}setPoint(null);setBusy(true);setMessage('Waiting for your location permission…');navigator.geolocation.getCurrentPosition(position=>{setPoint({latitude:position.coords.latitude,longitude:position.coords.longitude});setSort('distance');setBusy(false);setMessage('Distances from your current location');},error=>{setBusy(false);setMessage(error.code===1?'Location permission was declined. Enter a postcode instead.':'Your location could not be found. Enter a postcode instead.');},{enableHighAccuracy:false,timeout:15000,maximumAge:300000});}
 const ordered=orderedDevelopers(cards,sort,point);
 const imageLayout=`${view}:${ordered.map(c=>c.slug).join(",")}`;
 return <section aria-label="Homebuilder collections"><div className="directory-toolbar"><ViewOptions view={view} onChange={changeView} ariaLabel="Collection layout"/><div className="sort-control"><label htmlFor="directory-order">Order by</label><select id="directory-order" value={sort} onChange={e=>setSort(e.target.value)}><option value="name">Name A–Z</option><option value="spaces">Most interiors</option><option value="distance">Nearest distance</option></select></div></div>{sort==='distance'&&<div className="distance-controls"><form onSubmit={locatePostcode}><label htmlFor="distance-postcode">Your postcode</label><div><input id="distance-postcode" autoComplete="postal-code" value={postcode} onChange={e=>setPostcode(e.target.value)} placeholder="e.g. SW1A 1AA" required maxLength={10}/><button disabled={busy}>Find distance</button></div></form><button type="button" disabled={busy} onClick={locateBrowser}>Use my location</button><p className="subtle">Straight-line miles to each homebuilder’s nearest development with matching interiors.</p><p role="status" className="location-status">{message||'Enter a postcode or allow browser location to sort by distance.'}</p></div>}<div className={`collection-grid directory-${view}`}>{ordered.map(card=><a className="collection-card" href={`/developers/${card.slug}`} key={card.slug}><ScrollCollectionImage images={card.images} image={card.image} description={card.description} layout={imageLayout}/><div className="card-body"><p className="eyebrow">THE HOMEBUILDER COLLECTION</p><h2><BuilderName name={card.name}/><span aria-hidden="true">↗</span></h2><p>{card.spaces} inspiring interiors</p>{sort==='distance'&&point&&<p className="subtle">{card.nearest?`${card.nearest.miles.toFixed(1)} miles · ${card.nearest.name}`:'Location unavailable'}</p>}<span className="subtle">Explore collection →</span></div></a>)}</div></section>;
}
