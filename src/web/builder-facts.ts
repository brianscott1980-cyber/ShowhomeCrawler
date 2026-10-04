export type BuilderFacts={rating?:{stars:number;year:number;source:string;scope?:string};incentives?:{source:string;checkedAt:string}};
const ratingSource='https://www.hbf.co.uk/documents/15516/HBF_CSS_and_Star_ratings_2026_brochure_4.pdf';
// Explicit matches to the published 2026 award list. Group awards retain their scope.
const rated:Record<string,string|undefined>={bellway:undefined,cala:'CALA Group','taylor-wimpey':undefined,'miller-homes':undefined,persimmon:undefined,'robertson-homes':undefined,'crest-nicholson':undefined,'story-homes':undefined,'hill-group':undefined,'bloor-homes':undefined,keepmoat:undefined,'morris-homes':'Morris Homes Group','castle-green-homes':undefined,dandara:undefined,barratt:'Barratt Redrow',redrow:'Barratt Redrow','david-wilson':'Barratt Redrow','bovis-homes':'Vistry Homes','linden-homes':'Vistry Homes','countryside-homes':'Vistry Homes'};
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
 return {...(Object.hasOwn(rated,slug)?{rating:{stars:5,year:2026,source:ratingSource,...(rated[slug]?{scope:rated[slug]}:{})}}:{}),...(offers[slug]?{incentives:{source:offers[slug],checkedAt:'2026-10-04'}}:{})};
}
