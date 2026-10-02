import {expect,it} from 'vitest';
import {scrollCrossing,collectionIndex} from '../src/web/scroll-crossing';
const edges=(top:number,bottom:number)=>({top,bottom});
it('waits for the bottom edge when scrolling down, then advances once',()=>{
 expect(scrollCrossing(edges(230,430),edges(190,390),200,40)).toBe(0);
 expect(scrollCrossing(edges(30,230),edges(-10,190),200,40)).toBe(1);
 expect(scrollCrossing(edges(-10,190),edges(-50,150),200,40)).toBe(0);
});
it('waits for the top edge when scrolling up, then reverses once',()=>{
 expect(scrollCrossing(edges(-10,190),edges(30,230),200,-40)).toBe(0);
 expect(scrollCrossing(edges(190,390),edges(230,430),200,-40)).toBe(-1);
 expect(scrollCrossing(edges(230,430),edges(270,470),200,-40)).toBe(0);
});
it('ignores stationary scrolling and layout movements against the scroll direction',()=>{
 expect(scrollCrossing(edges(30,230),edges(-10,190),200,0)).toBe(0);
 expect(scrollCrossing(edges(30,230),edges(-10,190),200,-40)).toBe(0);
 expect(scrollCrossing(edges(190,390),edges(230,430),200,40)).toBe(0);
});
it('handles exact threshold crossings and wraps in both directions',()=>{
 expect(scrollCrossing(edges(0,200),edges(-1,199),200,1)).toBe(1);
 expect(scrollCrossing(edges(200,400),edges(201,401),200,-1)).toBe(-1);
 expect(collectionIndex(2,1,3)).toBe(0);
 expect(collectionIndex(0,-1,3)).toBe(2);
 expect(collectionIndex(0,1,1)).toBe(0);
});
it('staggered four-column rows advance left to right and reverse right to left',async()=>{
 const {rowScrollCrossing}=await import('../src/web/scroll-crossing');
 expect([0,1,2,3].map(i=>rowScrollCrossing(0,.3,i,4,100))).toEqual([1,0,0,0]);
 expect([0,1,2,3].map(i=>rowScrollCrossing(.3,.7,i,4,100))).toEqual([0,1,1,0]);
 expect([0,1,2,3].map(i=>rowScrollCrossing(1,.7,i,4,-100))).toEqual([0,0,0,-1]);
 expect([0,1,2,3].map(i=>rowScrollCrossing(.7,.3,i,4,-100))).toEqual([0,-1,-1,0]);
});
it('calculates midpoint traversal and adapts to incomplete and single-column rows',async()=>{
 const {rowProgress,rowScrollCrossing}=await import('../src/web/scroll-crossing');
 expect(rowProgress({top:600,bottom:1000},400)).toBe(0);
 expect(rowProgress({top:300,bottom:700},400)).toBe(.25);
 expect(rowProgress({top:-100,bottom:300},400)).toBe(1);
 expect(rowScrollCrossing(0,.3,0,2,100)).toBe(1);
 expect(rowScrollCrossing(0,.3,1,2,100)).toBe(0);
 expect(rowScrollCrossing(.4,.6,0,1,100)).toBe(1);
 expect(rowScrollCrossing(0,1,0,4,0)).toBe(0);
 expect(rowScrollCrossing(.2,.3,0,4,100)).toBe(0);
});
it('completes only unreachable bottom triggers with rounding tolerance',async()=>{
 const {atPageBottom,bottomRemainder}=await import('../src/web/scroll-crossing');
 expect(atPageBottom(1199,800,2000)).toBe(true);
 expect(atPageBottom(1100,800,2000)).toBe(false);
 expect(bottomRemainder(true,{top:500,bottom:700},0,0,1,400)).toBe(true);
 expect(bottomRemainder(true,{top:100,bottom:300},0,0,1,400)).toBe(false);
 expect([0,1,2,3].map(i=>bottomRemainder(false,{top:300,bottom:700},.4,i,4,400))).toEqual([false,false,true,true]);
});
