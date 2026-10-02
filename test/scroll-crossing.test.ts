import {expect,it} from 'vitest';
import {scrollCrossing,collectionIndex} from '../src/web/scroll-crossing';
it('advances once when scrolling down crosses the upper quarter',()=>{
 expect(scrollCrossing(230,190,200,40)).toBe(1);
 expect(scrollCrossing(190,150,200,40)).toBe(0);
 expect(scrollCrossing(270,230,200,40)).toBe(0);
});
it('reverses only when scrolling up crosses the same line',()=>{
 expect(scrollCrossing(190,230,200,-40)).toBe(-1);
 expect(scrollCrossing(230,270,200,-40)).toBe(0);
 expect(scrollCrossing(150,190,200,-40)).toBe(0);
});
it('ignores stationary scrolling and layout movements against the scroll direction',()=>{
 expect(scrollCrossing(230,190,200,0)).toBe(0);
 expect(scrollCrossing(230,190,200,-40)).toBe(0);
 expect(scrollCrossing(190,230,200,40)).toBe(0);
});
it('handles exact threshold crossings and wraps in both directions',()=>{
 expect(scrollCrossing(200,199,200,1)).toBe(1);
 expect(scrollCrossing(200,201,200,-1)).toBe(-1);
 expect(collectionIndex(2,1,3)).toBe(0);
 expect(collectionIndex(0,-1,3)).toBe(2);
 expect(collectionIndex(0,1,1)).toBe(0);
});
