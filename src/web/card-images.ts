import type {ReportImage} from '../reports/report';
import {assetUrl} from './collections';
export interface CardImage {src:string;alt:string;roomType?:string;kind?:'logo';background?:string}
function shuffle<T>(values:T[],random:()=>number):T[]{
 const result=[...values];
 for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j]!,result[i]!];}
 return result;
}
/** Visit each available room type in random order before taking another from that type. */
export function randomRoomImages(images:CardImage[],random:()=>number=Math.random):CardImage[]{
 const unique=[...new Map(images.map(image=>[image.src,image])).values()];
 const rooms=new Map<string,CardImage[]>();
 for(const image of unique){const key=image.roomType?.trim().toLowerCase()||'uncategorised';const room=rooms.get(key)??[];room.push(image);rooms.set(key,room);}
 const roomKey=(image:CardImage)=>image.roomType?.trim().toLowerCase()||'uncategorised';
 let buckets=[...rooms.values()].map(room=>shuffle(room,random));
 const result:CardImage[]=[];
 while(buckets.length){
  buckets=shuffle(buckets,random);
  // Avoid repeating the last room at the boundary between rounds where possible.
  const previous=result.at(-1);const last=previous?roomKey(previous):undefined;
  if(buckets.length>1&&roomKey(buckets[0]![0]!)===last){const other=buckets.findIndex(b=>roomKey(b[0]!)!==last);if(other>0)[buckets[0],buckets[other]]=[buckets[other]!,buckets[0]!];}
  for(const bucket of buckets)result.push(bucket.shift()!);
  buckets=buckets.filter(bucket=>bucket.length);
 }
 return result;
}
export function reportCardImage(slug:string,image:ReportImage):CardImage {
 const room=image.categorisation?.mainCategory??image.verdict?.roomType??'Uncategorised';
 return {src:assetUrl(slug,image.path),alt:image.verdict?.description??image.categorisation?.subCategory??'Showhome interior',roomType:room};
}
/** Generate on the server so the browser hydrates the same random starting image and order. */
export function cardImageCollection(images:CardImage[],firstImage?:CardImage,random:()=>number=Math.random){
 const available=[...new Map(images.filter(i=>i.src!==firstImage?.src).map(i=>[i.src,i])).values()];
 const exteriors=firstImage?.kind==='logo'?available.filter(i=>/^exterior(?:\s|$)/i.test(i.roomType?.trim()??'')):[];
 const exterior=exteriors.length?exteriors[Math.floor(random()*exteriors.length)]:undefined;
 const rooms=randomRoomImages(available.filter(i=>i.src!==exterior?.src),random);
 const ordered=[...(firstImage?[firstImage]:[]),...(exterior?[exterior]:[]),...rooms];
 return {images:ordered,image:ordered[0]?.src??'',description:ordered[0]?.alt??'Showhome interior'};
}
