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
