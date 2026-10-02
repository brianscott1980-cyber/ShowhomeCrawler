export interface CardEdges {top:number;bottom:number}
/** Downward scrolling uses the bottom edge; upward scrolling uses the top edge. */
export function scrollCrossing(previous:CardEdges,current:CardEdges,threshold:number,scrollDelta:number):number {
 if(scrollDelta>0&&previous.bottom>=threshold&&current.bottom<threshold)return 1;
 if(scrollDelta<0&&previous.top<=threshold&&current.top>threshold)return -1;
 return 0;
}
export function collectionIndex(index:number,direction:number,length:number){return length>0?(index+direction+length)%length:0;}
