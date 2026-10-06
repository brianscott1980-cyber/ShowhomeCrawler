// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {CardImage} from '../src/web/card-image';

it('shows the loading mark until load, resets for a new source, and stops pulsing after failure',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const mount=document.createElement('div'),root=createRoot(mount),onLoad=vi.fn();
 try{
  await act(async()=>root.render(<CardImage src="/first.jpg" alt="Room" onLoad={onLoad}/>));
  expect(mount.querySelector('.card-image-loading')).not.toBeNull();expect(mount.querySelector('img')?.style.opacity).toBe('0');
  await act(async()=>mount.querySelector('img')!.dispatchEvent(new Event('load')));
  expect(onLoad).toHaveBeenCalledOnce();expect(mount.querySelector('.card-image-loading')).toBeNull();
  await act(async()=>root.render(<CardImage src="/next.jpg" alt="Room"/>));expect(mount.querySelector('.card-image-loading')).not.toBeNull();
  await act(async()=>mount.querySelector('img')!.dispatchEvent(new Event('error')));expect(mount.querySelector('.card-image-failed')).not.toBeNull();
  await act(async()=>root.unmount());
 }finally{vi.unstubAllGlobals();}
});

it('recognises an image already loaded before hydration',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const width=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'naturalWidth');
 Object.defineProperty(HTMLImageElement.prototype,'naturalWidth',{configurable:true,get:()=>640});
 const complete=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'complete');Object.defineProperty(HTMLImageElement.prototype,'complete',{configurable:true,get:()=>true});
 const mount=document.createElement('div'),root=createRoot(mount);
 try{await act(async()=>root.render(<CardImage src="/cached.jpg" alt="Room"/>));expect(mount.querySelector('.card-image-loading')).toBeNull();await act(async()=>root.unmount());}
 finally{if(width)Object.defineProperty(HTMLImageElement.prototype,'naturalWidth',width);if(complete)Object.defineProperty(HTMLImageElement.prototype,'complete',complete);vi.unstubAllGlobals();}
});
