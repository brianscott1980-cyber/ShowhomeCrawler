// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {BuildingDevelopmentList} from '../src/web/building-development-list';
vi.mock('../src/web/location-preferences',()=>({useSavedLocation:()=>({latitude:55,longitude:-3})}));
vi.mock('../src/web/site-map',()=>({SiteMap:({activeKey,onSelect}:{activeKey:string|null;onSelect:(key:string)=>void})=><button data-active={activeKey??''} className="test-marker" onClick={()=>onSelect('far')}>Map marker</button>}));
it('links card and marker selection, and sorts developments nearest first',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}});
 const mount=document.createElement('div'),root=createRoot(mount),scroll=vi.fn();
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 HTMLElement.prototype.scrollIntoView=scroll;
 const item={name:'Development',href:null,town:'Town',longitude:-3,price:'£300,000',developer:'Builder',image:null,logo:null,logoBackground:'#fff'};
 try{
  await act(async()=>root.render(<BuildingDevelopmentList buildingName="House" developments={[{...item,key:'far',latitude:58},{...item,key:'near',latitude:55.1}]}/>));
  await act(async()=>mount.querySelector<HTMLButtonElement>('.building-developments-trigger')!.click());
  const cards=mount.querySelectorAll<HTMLButtonElement>('.building-development-select');
  expect(cards[0]?.textContent).toContain('6.9 miles');
  await act(async()=>cards[0]!.click());
  expect(mount.querySelector('.test-marker')?.getAttribute('data-active')).toBe('near');
  await act(async()=>mount.querySelector<HTMLButtonElement>('.test-marker')!.click());
  expect(cards[1]?.getAttribute('aria-pressed')).toBe('true');
  expect(scroll).toHaveBeenCalledOnce();
 }finally{await act(async()=>root.unmount());vi.unstubAllGlobals();}
});
