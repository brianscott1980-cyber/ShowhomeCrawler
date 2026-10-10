import {builderFacts} from './builder-facts';
import {readWebsiteBuilder} from '../database/website';
export async function BuilderOverviewDetails({slug,website,countries}:{slug:string;website:string;countries:string[]}){
 const facts=await builderFacts(slug),office=(await readWebsiteBuilder(slug))?.office;
 return <><h2>About the builder</h2><dl className="builder-overview-facts">
  <div><dt>HBF Rating</dt><dd>{facts.rating?<a href={facts.rating.source} target="_blank" rel="noreferrer" aria-label={`HBF rating ${facts.rating.value} out of 5`} className="builder-rating-houses">{Array.from({length:Math.ceil(facts.rating.value)},(_,index)=><svg key={index} width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path opacity=".2" d="M12 3 2 11h3v10h5v-7h4v7h5V11h3L12 3Z"/><path style={{clipPath:facts.rating!.value-index<1?'inset(0 50% 0 0)':undefined}} d="M12 3 2 11h3v10h5v-7h4v7h5V11h3L12 3Z"/></svg>)}</a>:'Not available'}</dd></div>
  <div><dt>Ratings</dt><dd>{facts.reviews?`${facts.reviews.average.toFixed(1)} (${facts.reviews.count.toLocaleString('en-GB')})`:'Not available'}</dd></div>
  {facts.reviews?.sources.map(source=><div key={source.name}><dt>{source.name.replace(' (main office)','')}</dt><dd><a href={source.url} target="_blank" rel="noreferrer">{source.rating.toFixed(1)} ({source.count.toLocaleString('en-GB')}) ↗</a></dd></div>)}
  <div className="builder-company-address"><dt>Company address</dt><dd>{office?.address?<address>{office.address}</address>:'Not available'}</dd></div>
  {office?.telephone&&<div><dt>Telephone</dt><dd><a href={`tel:${office.telephone.replace(/[^+\d]/g,'')}`}>{office.telephone}</a></dd></div>}
  {office?.email&&<div><dt>Email</dt><dd><a href={`mailto:${office.email}`}>{office.email}</a></dd></div>}
  <div className="builder-country-coverage"><dt>Countries covered</dt><dd>{countries.sort().join(', ')||'Not available'}</dd></div>
 </dl><a className="builder-website-link" href={website} target="_blank" rel="noreferrer">Visit builder website ↗</a></>;
}
