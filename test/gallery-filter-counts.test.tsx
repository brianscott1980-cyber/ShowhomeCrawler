// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {Gallery} from '../src/web/gallery';
import type {RunReport} from '../src/reports/report';
it('updates development totals and restarts the rolodex on bedroom filtering and reset',async()=>{
 vi.stubEnv('NEXT_PUBLIC_CASCADING_FILTERS','true');
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:()=>{},removeEventListener:()=>{}}));
 vi.stubGlobal('scrollTo',vi.fn());
 vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{callback(0);return 0;});
 window.history.replaceState(null,'','/developments/builder/example');
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const report={properties:[2,4].map(bedrooms=>({name:`Home ${bedrooms}`,url:`/home-${bedrooms}`,bedrooms,price:bedrooms*100000,development:'Example',developmentUrl:'/example',imageIds:[String(bedrooms)],plots:[]})),images:[2,4].map(bedrooms=>({id:String(bedrooms),path:`${bedrooms}.jpg`,verdict:{matches:true,description:'Interior'},categorisation:{mainCategory:bedrooms===2?'Kitchen':'Bedroom',isRoom:true,objects:[],colours:[bedrooms===2?'Blue':'Green'],chairs:[]}}))} as unknown as RunReport;
 const totals=()=>[...host.querySelectorAll('.results-stats .sr-only')].map(e=>e.textContent);
 try{
  await act(async()=>root.render(<Gallery collections={[{slug:'builder',name:'Builder',report}]} includeUnclassified introduction={{title:'Example',description:'Example',eyebrow:null,developmentDetails:<div>Details</div>,counts:{'Building Types':2,'Room Types':2,Interiors:2}}}/>));
  expect(totals()).toEqual(['2','2','2']);const previous=host.querySelector('.results-stats .rolling-count');
  const min=host.querySelector('[role=listbox][aria-label="Minimum bedrooms"]')!;
  await act(async()=>[...min.querySelectorAll<HTMLButtonElement>('button')].find(e=>e.textContent?.startsWith('4 Beds'))!.click());
  expect(totals()).toEqual(['1','1','1']);expect(host.querySelector('.results-stats .rolling-count')).not.toBe(previous);
  await act(async()=>host.querySelector<HTMLButtonElement>('.location-filter-reset')!.click());
  expect(totals()).toEqual(['2','2','2']);
  await act(async()=>host.querySelector<HTMLButtonElement>('button.tag[title="Filter by Blue"]')!.click());
  expect(host.querySelectorAll('.image-card')).toHaveLength(1);
  expect(host.querySelector<HTMLButtonElement>('button.tag[title="Filter by Blue"]')!.getAttribute('aria-pressed')).toBe('true');
  await act(async()=>host.querySelector<HTMLButtonElement>('button.tag[title="Filter by Blue"]')!.click());
  expect(host.querySelectorAll('.image-card')).toHaveLength(2);
 }finally{await act(async()=>root.unmount());host.remove();sessionStorage.clear();localStorage.clear();window.history.replaceState(null,'','/');vi.unstubAllGlobals();vi.unstubAllEnvs();}
});
