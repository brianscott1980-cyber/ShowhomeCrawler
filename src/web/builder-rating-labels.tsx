import type {BuilderFacts} from './builder-facts';
export function BuilderRatingLabels({facts,builderName='Builder'}:{facts?:BuilderFacts;builderName?:string}){return <>
 <div><dt>{builderName} HBF</dt><dd>{facts?.rating?<a href={facts.rating.source} target="_blank" rel="noreferrer">{facts.rating.stars} stars · {facts.rating.year}</a>:'Not available'}</dd></div>
 <div><dt>{builderName} reviews</dt><dd>{facts?.reviews?<><span>{facts.reviews.average.toFixed(1)} / 5 · {facts.reviews.count.toLocaleString('en-GB')} reviews</span><details><summary>Rating sources</summary>{facts.reviews.sources.map(s=><p key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.name}: {s.rating.toFixed(1)} / 5 ({s.count.toLocaleString('en-GB')})</a> · checked {new Date(s.checkedAt).toLocaleDateString('en-GB',{timeZone:'Europe/London'})}</p>)}</details></>:'Not available'}</dd></div>
 </>;}
