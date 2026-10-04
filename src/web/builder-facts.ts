import googleReviews from '../data/builder-google-reviews.json';
export type BuilderFacts={rating?:{stars:number;score:number;value:number;year:number;source:string;scope?:string};reviews?:{average:number;count:number;sources:{name:string;rating:number;count:number;url:string;checkedAt:string}[]};incentives?:{source:string;checkedAt:string}};
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
 const builder=builderRatings.find(builder=>builder.slug===slug);
 const hbf=builder?.hbf;
 const google=googleReviews.find(builder=>builder.slug===slug);
 const sources:NonNullable<BuilderFacts['reviews']>['sources']=[];
 const trustpilot=builder?.trustpilot;
 if(trustpilot?.status==='verified_profile'&&trustpilot.rating!==null&&trustpilot.reviewCount&&trustpilot.url)sources.push({name:'Trustpilot',rating:trustpilot.rating,count:trustpilot.reviewCount,url:trustpilot.url,checkedAt:trustpilot.checkedAt});
 if(google?.status==='verified'&&google.rating!==null&&google.reviewCount&&google.url)sources.push({name:'Google (main office)',rating:google.rating,count:google.reviewCount,url:google.url,checkedAt:google.checkedAt});
 const count=sources.reduce((total,source)=>total+source.count,0);
 const reviews=count?{average:sources.reduce((total,source)=>total+source.rating*source.count,0)/count,count,sources}:undefined;
 return {...(reviews?{reviews}:{}),...(hbf?.rating&&hbf.compositeScore!==null?{rating:{stars:hbf.rating,score:hbf.compositeScore,value:Math.round(hbf.compositeScore*2)/2,year:hbf.year,source:hbf.compositeSource!,...(hbf.scope?{scope:hbf.scope}:{})}}:{}),...(offers[slug]?{incentives:{source:offers[slug],checkedAt:'2026-10-04'}}:{})};
}
