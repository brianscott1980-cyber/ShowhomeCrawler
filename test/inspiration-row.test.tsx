// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {InspirationRow} from '../src/web/inspiration-row';

it('pauses an active slide on hover and resumes it without restarting',async()=>{
 vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 let visible:(entries:{isIntersecting:boolean}[])=>void=()=>{};
 vi.stubGlobal('IntersectionObserver',class{constructor(callback:typeof visible){visible=callback;}observe(){}disconnect(){}});
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));
 const animation={pause:vi.fn(),play:vi.fn(),cancel:vi.fn(),onfinish:null as null|(()=>void)};
 const animate=vi.fn(()=>animation);Object.defineProperty(HTMLElement.prototype,'animate',{configurable:true,value:animate});
 const mount=document.createElement('div');document.body.append(mount);const root=createRoot(mount);
 try{
  await act(async()=>root.render(<InspirationRow>{Array.from({length:20},(_,index)=><article key={index}>Idea {index}</article>)}</InspirationRow>));
  await act(async()=>visible([{isIntersecting:true}]));await act(async()=>vi.advanceTimersByTime(3600));expect(animate).toHaveBeenCalledTimes(1);
  const row=mount.querySelector('.inspiration-loop')!;
  await act(async()=>row.dispatchEvent(new Event('pointerover',{bubbles:true})));expect(animation.pause).toHaveBeenCalled();
  await act(async()=>vi.advanceTimersByTime(10000));expect(animate).toHaveBeenCalledTimes(1);
  await act(async()=>row.dispatchEvent(new Event('pointerout',{bubbles:true})));expect(animation.play).toHaveBeenCalled();
  await act(async()=>animation.onfinish?.());expect(mount.querySelector('article')?.textContent).toBe('Idea 1');expect(mount.querySelectorAll('article')).toHaveLength(20);
  await act(async()=>root.unmount());expect(animation.cancel).toHaveBeenCalled();
 }finally{mount.remove();delete (HTMLElement.prototype as any).animate;vi.useRealTimers();vi.unstubAllGlobals();}
});
