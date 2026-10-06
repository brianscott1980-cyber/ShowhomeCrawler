/** Directory carousels are previews; the destination gallery retains every image. */
export function directoryPreview<T extends {images:unknown[]}>(card:T):T{return {...card,images:card.images.slice(0,12)};}
/** Counts need identity equality, not long SHA filenames in the browser payload. */
export function directoryIdentityEncoder(){
 const identities=new Map<string,string>();
 return (key:string)=>{let value=identities.get(key);if(value===undefined){value=identities.size.toString(36);identities.set(key,value);}return value;};
}
/** Merge equivalent filter rows while retaining every image identity for exact counts. */
export function compactDirectoryPlaces<T extends {siteId:string;developer:string;bedrooms:number|null;locations:string[];imageIds:string[]}>(places:T[]):T[]{
 const rows=new Map<string,{place:T;images:Set<string>}>();
 for(const place of places){
  const key=JSON.stringify([place.siteId,place.developer,place.bedrooms,place.locations]);
  const current=rows.get(key);
  if(current)for(const id of place.imageIds)current.images.add(id);
  else rows.set(key,{place,images:new Set(place.imageIds)});
 }
 return [...rows.values()].map(({place,images})=>({...place,imageIds:[...images]}));
}
