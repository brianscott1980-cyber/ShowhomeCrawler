/** A card advances only when scrolling carries its top across the upper quarter. */
export function scrollCrossing(previousTop:number,top:number,threshold:number,scrollDelta:number):number {
 if(scrollDelta>0&&previousTop>=threshold&&top<threshold)return 1;
 if(scrollDelta<0&&previousTop<=threshold&&top>threshold)return -1;
 return 0;
}
export function collectionIndex(index:number,direction:number,length:number){return length>0?(index+direction+length)%length:0;}
