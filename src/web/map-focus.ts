import type {FocusArea} from './map-marker-visibility';

export function focusPadding(area:FocusArea|undefined,size:{clientWidth:number;clientHeight:number}){return area?{left:Math.max(0,area.left),top:Math.max(0,area.top),right:Math.max(0,size.clientWidth-area.right),bottom:Math.max(0,size.clientHeight-area.bottom)}:{left:0,top:0,right:0,bottom:0};}
