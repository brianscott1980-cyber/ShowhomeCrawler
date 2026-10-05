// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {Gallery} from '../src/web/gallery';
import type {RunReport} from '../src/reports/report';
it('starts builder carousel on the map paused and enables playback only on request',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const report={properties:[],images:[{id:'one',path:'one.jpg',verdict:{matches:true,description:'Kitchen'},categorisation:{mainCategory:'Kitchen',isRoom:true,objects:[],colours:[],chairs:[]}}]} as unknown as RunReport;
 try{
  await act(async()=>root.render(<Gallery collections={[{slug:'example',name:'Example',report}]} includeUnclassified overviewOnly introduction={{title:'Example',description:'Example',eyebrow:null,map:<div>Development map</div>}}/>));
  expect(host.querySelector('.builder-hero-map')).not.toBeNull();
  expect(host.querySelector('.is-manually-paused')).not.toBeNull();
  await act(async()=>host.querySelector('.results-slide-progress span')!.dispatchEvent(new Event('webkitAnimationEnd',{bubbles:true})));
  expect(host.querySelector('.builder-hero-map')).not.toBeNull();
  await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Play carousel"]')!.click());
  expect(host.querySelector('[aria-label="Pause carousel"]')).not.toBeNull();
  await act(async()=>host.querySelector('.results-slide-progress span')!.dispatchEvent(new Event('webkitAnimationEnd',{bubbles:true})));
  expect(host.querySelector('.builder-hero-map')).toBeNull();
  await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Pause carousel"]')!.click());
  expect(host.querySelector('.is-manually-paused')).not.toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
