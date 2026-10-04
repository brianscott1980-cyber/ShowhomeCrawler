// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {DirectoryCountProvider,DirectoryCounts} from '../src/web/directory-counts';
import {DeveloperDirectory,type DeveloperCard} from '../src/web/directory';
vi.mock('../src/auth/browser',()=>({authClient:async()=>{throw new Error('Guest');}}));
it('updates summary totals and restarts the rolling animation when builders are filtered',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const cards:DeveloperCard[]=[{slug:'a',name:'A',spaces:1,image:'/a.jpg',description:'',locations:[{name:'North site',key:'north',region:'North',buildingTypes:['type-a']}]},{slug:'b',name:'B',spaces:1,image:'/b.jpg',description:'',locations:[{name:'South site',key:'south',region:'South',buildingTypes:['type-b']}]}];
 try{
  window.history.replaceState(null,'','/homebuilders');
  await act(async()=>root.render(<DirectoryCountProvider><DirectoryCounts initial={{Builders:2,Developments:2,'Building types':2}}/><DeveloperDirectory cards={cards}/></DirectoryCountProvider>));
  const before=host.querySelector('.directory-intro-counts .rolling-count');
  const checkbox=Array.from(host.querySelectorAll<HTMLInputElement>('input[type=checkbox]')).find(input=>input.parentElement?.textContent==='North')!;
  await act(async()=>checkbox.click());
  expect(Array.from(host.querySelectorAll('.directory-intro-counts .sr-only')).map(element=>element.textContent)).toEqual(['1','1','1']);
  expect(host.querySelector('.directory-intro-counts .rolling-count')).not.toBe(before);
  await act(async()=>checkbox.click());
  expect(Array.from(host.querySelectorAll('.directory-intro-counts .sr-only')).map(element=>element.textContent)).toEqual(['2','2','2']);
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
