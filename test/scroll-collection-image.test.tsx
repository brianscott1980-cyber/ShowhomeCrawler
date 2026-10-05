// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {ScrollCollectionImage} from '../src/web/scroll-collection-image';

it('returns to the logo without wrapping when page-bottom and row triggers reverse separately',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 vi.stubGlobal('IntersectionObserver',class {observe(){} disconnect(){}});
 let frame:FrameRequestCallback|undefined,y=0,hovered=false;
 vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{frame=callback;return 1;});
 vi.stubGlobal('cancelAnimationFrame',()=>{});
 vi.spyOn(window,'scrollY','get').mockImplementation(()=>y);
 vi.spyOn(window,'innerHeight','get').mockReturnValue(800);
 vi.spyOn(document.documentElement,'scrollHeight','get').mockReturnValue(1100);
 const grid=document.createElement('div');grid.className='directory-compact';document.body.append(grid);
 const mounts=Array.from({length:4},(_,column)=>{
  const card=document.createElement('div');card.className='collection-card';grid.append(card);
  vi.spyOn(card,'getBoundingClientRect').mockImplementation(()=>({top:610-y-(hovered&&column===2?3:0),bottom:1010-y-(hovered&&column===2?3:0),left:column*200,right:(column+1)*200,width:200,height:400,x:column*200,y:610-y,toJSON(){}}));
  return {card,root:createRoot(card)};
 });
 const images=[{src:'/logo.svg',alt:'Builder',kind:'logo' as const},{src:'/exterior.jpg',alt:'Exterior'},{src:'/room.jpg',alt:'Room'}];
 const scroll=async(position:number)=>{await act(async()=>{y=position;window.dispatchEvent(new Event('scroll'));const callback=frame;frame=undefined;callback?.(0);});};
 const sources=()=>mounts.map(({card})=>card.querySelector('.collection-image-current')?.getAttribute('src'));
 try {
  await act(async()=>{for(const {root} of mounts)root.render(<ScrollCollectionImage images={images} image="/logo.svg" description="Builder" layout="compact"/>);});
  await scroll(300);expect(sources()).toEqual(Array(4).fill('/exterior.jpg'));
  // A later natural crossing must not advance the bottom-forced card again.
  await scroll(400);expect(sources()).toEqual(Array(4).fill('/exterior.jpg'));
  hovered=true;
  await scroll(290);expect(sources()).toEqual(['/exterior.jpg','/exterior.jpg','/logo.svg','/logo.svg']);
  await scroll(100);expect(sources()).toEqual(['/exterior.jpg','/logo.svg','/logo.svg','/logo.svg']);
  await scroll(0);expect(sources()).toEqual(Array(4).fill('/logo.svg'));
  await scroll(500);expect(sources()).toEqual(Array(4).fill('/exterior.jpg'));
  await scroll(0);expect(sources()).toEqual(Array(4).fill('/logo.svg'));
  await scroll(400);expect(sources()).toEqual(Array(4).fill('/exterior.jpg'));
  // A resize can move the baseline below the trigger before the next scroll frame.
  await act(async()=>{y=290;window.dispatchEvent(new Event('resize'));});
  await scroll(280);expect(sources()).toEqual(['/exterior.jpg','/exterior.jpg','/logo.svg','/logo.svg']);
  await scroll(0);expect(sources()).toEqual(Array(4).fill('/logo.svg'));
 } finally {
  await act(async()=>{for(const {root} of mounts)root.unmount();});grid.remove();vi.restoreAllMocks();vi.unstubAllGlobals();
 }
});
