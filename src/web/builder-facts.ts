export type BuilderFacts={rating?:{stars:number;year:number;source:string;scope?:string};incentives?:{source:string;checkedAt:string}};
import builderRatings from '../data/builder-ratings.json';
const offers:Record<string,string>={
 bellway:'https://www.bellway.co.uk/autumn-incentives',
 barratt:'https://www.barratthomes.co.uk/offers/deposit-boost/',
 cala:'https://www.cala.co.uk/legal/terms-and-conditions/offers-and-incentives/',
 'taylor-wimpey':'https://www.taylorwimpey.co.uk/ways-to-buy/mortgage-contribution-scheme',
 'miller-homes':'https://www.millerhomes.co.uk/promo/incentives/picture-this',
 'bloor-homes':'https://bloorhomes.com/offers/deposit-boost?categories=DepositBoost',
 persimmon:'https://www.persimmonhomes.com/ways-to-help-you-buy/deposit-boost-5-deposit-contribution-scheme',
 redrow:'https://www.redrow.co.uk/buying-with-redrow/'
};
export function builderFacts(slug:string):BuilderFacts{
 const hbf=builderRatings.find(builder=>builder.slug===slug)?.hbf;
 return {...(hbf?.rating?{rating:{stars:hbf.rating,year:hbf.year,source:hbf.source,...(hbf.scope?{scope:hbf.scope}:{})}}:{}),...(offers[slug]?{incentives:{source:offers[slug],checkedAt:'2026-10-04'}}:{})};
}
