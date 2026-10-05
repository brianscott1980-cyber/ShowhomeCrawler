import {matchesSiteProperty,type SiteCard,type SiteFilters} from './site-filters';

/** Order by the lowest known price among homes matching the active filters. */
export function compareDevelopmentPrices(a:SiteCard,b:SiteCard,filters:SiteFilters,descending=false){
 const price=(card:SiteCard)=>{
  const prices=card.properties.filter(home=>matchesSiteProperty(home,filters)).map(home=>home.price).filter((value):value is number=>value!==null&&Number.isFinite(value));
  return prices.length?Math.min(...prices):null;
 };
 const first=price(a),second=price(b);
 if(first===null||second===null)return first===second?a.name.localeCompare(b.name):first===null?1:-1;
 return (descending?second-first:first-second)||a.name.localeCompare(b.name);
}
