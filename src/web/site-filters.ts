export interface SiteProperty {price:number|null;bedrooms:number|null;style:string|null}
export interface SiteCard {key:string;name:string;developer:string;images?:{src:string;alt:string}[];image:string;description:string;count:number;country:string|null;latitude?:number;longitude?:number;properties:SiteProperty[];propertyScope?:string}
export interface SiteFilters {developer:string;country:string;minPrice:string;maxPrice:string;minBeds:string;maxBeds:string;style:string;radius:string}
export interface LocationPoint {latitude:number;longitude:number}
export function milesBetween(a:LocationPoint,b:LocationPoint){const rad=(n:number)=>n*Math.PI/180;const h=Math.sin(rad(b.latitude-a.latitude)/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(rad(b.longitude-a.longitude)/2)**2;return 3958.7613*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
export function filterSites(cards:SiteCard[],filters:SiteFilters,point:LocationPoint|null){return cards.map(card=>({...card,miles:point&&Number.isFinite(card.latitude)&&Number.isFinite(card.longitude)?milesBetween(point,{latitude:card.latitude!,longitude:card.longitude!}):null})).filter(card=>{
 if(filters.developer&&card.developer!==filters.developer)return false;
 if(filters.country&&(card.country??'Unknown')!==filters.country)return false;
 if(filters.radius&&point&&(card.miles===null||card.miles>Number(filters.radius)))return false;
 const active=filters.minPrice||filters.maxPrice||filters.minBeds||filters.maxBeds||filters.style;
 return !active||card.properties.some(p=>{
  if(filters.minPrice&&(p.price===null||p.price<Number(filters.minPrice)))return false;
  if(filters.maxPrice&&(p.price===null||p.price>Number(filters.maxPrice)))return false;
  if(filters.minBeds&&(p.bedrooms===null||p.bedrooms<Number(filters.minBeds)))return false;
  if(filters.maxBeds&&(p.bedrooms===null||p.bedrooms>Number(filters.maxBeds)))return false;
  return !filters.style||(p.style??'Unknown')===filters.style;
 });
});}
export function propertyStyle(type:string|null,detached:boolean|null,name?:string|null):string|null{
 if(type){
  if(/semi[ -]?detached/i.test(type))return 'Semi-detached';
  if(/terrac|attached|townhouse|town house|mews/i.test(type)&&!/detached/i.test(type))return 'Attached / terraced';
  if(/\bdetached\b/i.test(type))return 'Detached';
  if(/apartment|flat|duplex|maisonette/i.test(type))return 'Apartment';
 }
 if(name){
  if(/semi[ -]?detached/i.test(name))return 'Semi-detached';
  if(/terrac|attached|townhouse|town house|mews/i.test(name)&&!/detached/i.test(name))return 'Attached / terraced';
  if(/\bdetached\b/i.test(name))return 'Detached';
  if(/apartment|flat|duplex|maisonette/i.test(name))return 'Apartment';
 }
 return detached===true?'Detached':null;
}
