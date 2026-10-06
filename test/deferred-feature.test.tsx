// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {DeferredFeature} from '../src/web/deferred-feature';
it('waits for visibility and idle time, and cancels pending work when removed',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 let visible:(entries:{isIntersecting:boolean}[])=>void=()=>{},idle:()=>void=()=>{};
 const disconnect=vi.fn(),cancel=vi.fn();vi.stubGlobal('IntersectionObserver',class{constructor(callback:typeof visible){visible=callback;}observe(){}disconnect=disconnect;});
 Object.defineProperty(window,'requestIdleCallback',{configurable:true,value:vi.fn((callback:()=>void)=>{idle=callback;return 7;})});Object.defineProperty(window,'cancelIdleCallback',{configurable:true,value:cancel});
 const mount=document.createElement('div'),root=createRoot(mount);
 try{await act(async()=>root.render(<DeferredFeature><article>Map</article></DeferredFeature>));expect(mount.querySelector('article')).toBeNull();
 await act(async()=>visible([{isIntersecting:false}]));expect(window.requestIdleCallback).not.toHaveBeenCalled();
 await act(async()=>visible([{isIntersecting:true}]));expect(mount.querySelector('article')).toBeNull();await act(async()=>idle());expect(mount.querySelector('article')?.textContent).toBe('Map');
 await act(async()=>root.unmount());expect(disconnect).toHaveBeenCalled();expect(cancel).toHaveBeenCalledWith(7);
 }finally{vi.unstubAllGlobals();delete (window as any).requestIdleCallback;delete (window as any).cancelIdleCallback;}
});
