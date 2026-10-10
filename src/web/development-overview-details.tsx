'use client';
import {OpeningHours} from './opening-hours';
import type {DevelopmentContact} from './development-contact';
import type {BuilderFacts} from './builder-facts';
import {BuilderRatingLabels} from './builder-rating-labels';
import {useLocationRequest} from './location-dialog';
import {useSavedLocation} from './location-preferences';
import {hasCoordinates} from './site-map';
import {milesBetween,type SiteCard} from './site-filters';

function range(values:(number|null)[],format:(value:number)=>string){
 const known=values.filter((value):value is number=>value!==null&&Number.isFinite(value));
 if(!known.length)return 'Not available';
 const min=Math.min(...known),max=Math.max(...known);
 return min===max?format(min):`${format(min)} – ${format(max)}`;
}
export function DevelopmentOverviewDetails({card,contact={},facts}:{card:SiteCard;contact?:DevelopmentContact;facts?:BuilderFacts}){
 const location=useSavedLocation();
 const distance=location&&hasCoordinates(card)?milesBetween(location,card):null;
 const {requestLocation,dialog}=useLocationRequest(()=>{});
 return <div className="development-overview-details">{dialog}
  <dl className="site-property-summary">
   <div><dt>Location</dt><dd>{[card.country,card.town].filter(Boolean).join(', ')||'Not available'}</dd></div>
   <div><dt>Distance</dt><dd>{location?(distance===null?'Not available':`${distance.toFixed(1)} miles away`):<button className="development-set-location" type="button" onClick={()=>{void requestLocation(()=>{},{key:'radius',value:''});}}>Set Location</button>}</dd></div>
   <div><dt>Prices</dt><dd>{range(card.properties.map(home=>home.price),value=>'£'+value.toLocaleString('en-GB'))}</dd></div>
   <div><dt>Bedrooms</dt><dd>{range(card.properties.map(home=>home.bedrooms),String)}</dd></div>
   <div><dt>Styles</dt><dd>{[...new Set(card.properties.map(home=>home.style??'Unknown'))].map(style=><span className="development-style" key={style}>{style}</span>)}</dd></div>
  </dl>
  <dl className="development-contact-details">
   <BuilderRatingLabels facts={facts}/>
   {contact.address&&<div><dt>Address</dt><dd>{contact.address}</dd></div>}
   <div><dt>Telephone</dt><dd>{contact.telephone?<a href={`tel:${contact.telephone.replace(/[^+\d]/g,'')}`}>{contact.telephone}</a>:'Not available'}</dd></div>
   <div><dt>Email</dt><dd>{contact.email?<a href={`mailto:${contact.email}`}>{contact.email}</a>:'Not available'}</dd></div>
   <div><dt>Opening Hours</dt><dd><OpeningHours hours={contact.openingHours}/></dd></div>
  </dl>
 </div>;
}

