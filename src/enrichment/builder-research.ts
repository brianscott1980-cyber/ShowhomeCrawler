import {load} from 'cheerio';
export function hbfAnnual(html:string){const $=load(html);const surveys:any[]=[];$('script').each((_,e)=>{try{const v=JSON.parse($(e).text());if(Array.isArray(v))surveys.push(...v.filter(s=>s.annual&&Array.isArray(s.results)));}catch{}});return surveys.sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];}
export function profileReview(html:string,url:string){const $=load(html),nodes:any[]=[];function visit(v:any){if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(visit);return;}nodes.push(v);Object.values(v).forEach(visit);} $('script[type="application/ld+json"]').each((_,e)=>{try{visit(JSON.parse($(e).text()));}catch{}});
 const business=nodes.find(n=>n.aggregateRating&&typeof n.url==='string'&&new URL(n.url,url).pathname===new URL(url).pathname);if(!business)return;
 const rating=Number(business.aggregateRating.ratingValue),count=Number(business.aggregateRating.reviewCount),best=Number(business.aggregateRating.bestRating??5);
 if(best!==5||!Number.isFinite(rating)||rating<0||rating>5||!Number.isInteger(count)||count<=0)return;return {rating,count,name:business.name??'Trustpilot',url};
}
