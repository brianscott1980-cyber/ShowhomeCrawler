export interface CardEdges {top:number;bottom:number}
/** Downward scrolling uses the bottom edge; upward scrolling uses the top edge. */
export function scrollCrossing(previous:CardEdges,current:CardEdges,threshold:number,scrollDelta:number):number {
 if(scrollDelta>0&&previous.bottom>=threshold&&current.bottom<threshold)return 1;
 if(scrollDelta<0&&previous.top<=threshold&&current.top>threshold)return -1;
 return 0;
}
export function collectionIndex(index:number,direction:number,length:number){return length>0?(index+direction+length)%length:0;}
/** The midpoint traverses the row from its top (0) to its bottom (1). */
export function rowProgress(row:CardEdges,midpoint:number){return Math.max(0,Math.min(1,(midpoint-row.top)/Math.max(1,row.bottom-row.top)));}
export function rowScrollCrossing(previous:number,current:number,column:number,columns:number,scrollDelta:number){
 const trigger=(column+.5)/Math.max(1,columns);
 if(scrollDelta>0&&previous<trigger&&current>=trigger)return 1;
 if(scrollDelta<0&&previous>=trigger&&current<trigger)return -1;
 return 0;
}
export function atPageBottom(scrollY:number,viewportHeight:number,pageHeight:number){return scrollY+viewportHeight>=pageHeight-2;}
export function bottomRemainder(list:boolean,edges:CardEdges,progress:number,column:number,columns:number,midpoint:number){return list?edges.bottom>=midpoint:progress<(column+.5)/Math.max(1,columns);}
