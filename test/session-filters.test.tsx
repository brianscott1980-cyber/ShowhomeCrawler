// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
vi.mock('next/navigation',()=>({usePathname:()=>window.location.pathname}));
import {markFilterNavigation,rememberPageSource,setIncomingPageFilters} from '../src/web/navigation-memory';
import {useUrlFilters} from '../src/web/url-filters';
const defaults={radius:'',region:'',order:'name',lat:'',lng:'',zoom:''};
it('restores page values after navigating away while keeping both URLs clean',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 sessionStorage.clear();window.history.replaceState(null,'','/homebuilders');
 const container=document.createElement('div');document.body.append(container);
 let root=createRoot(container);
 let change:ReturnType<typeof useUrlFilters<typeof defaults>>[1];
 function Page(){const [filters,setFilters]=useUrlFilters(defaults);change=setFilters;return <output>{JSON.stringify(filters)}</output>;}
 try {
  await act(async()=>root.render(<Page/>));
  await act(async()=>change({...defaults,radius:'25',region:'Scotland',order:'distance'}));
  expect(window.location.pathname+window.location.search).toBe('/homebuilders');
  await act(async()=>root.unmount());
  window.history.replaceState(null,'','/locations');root=createRoot(container);
  await act(async()=>root.render(<Page/>));
  expect(JSON.parse(container.textContent!)).toEqual(defaults);
  await act(async()=>change({...defaults,lat:'57',lng:'-4',zoom:'8'}));
  expect(window.location.search).toBe('');
  await act(async()=>root.unmount());
  rememberPageSource(sessionStorage,'/homebuilders','/developers/example');
  markFilterNavigation(sessionStorage,'/developers/example','/homebuilders',window.location.origin);
  window.history.replaceState(null,'','/homebuilders');root=createRoot(container);
  await act(async()=>root.render(<Page/>));
  expect(JSON.parse(container.textContent!)).toEqual({...defaults,radius:'25',region:'Scotland',order:'distance'});
  expect(window.location.search).toBe('');
  await act(async()=>root.unmount());
  markFilterNavigation(sessionStorage,'/homebuilders','/locations',window.location.origin);
  window.history.replaceState(null,'','/locations?radius=50');root=createRoot(container);
  await act(async()=>root.render(<Page/>));
  expect(JSON.parse(container.textContent!)).toEqual({...defaults,radius:'50'});
  expect(window.location.search).toBe('');
  await act(async()=>root.unmount());
  markFilterNavigation(sessionStorage,'/','/homebuilders',window.location.origin);
  window.history.replaceState(null,'','/homebuilders');root=createRoot(container);
  await act(async()=>root.render(<Page/>));
  expect(JSON.parse(container.textContent!)).toEqual(defaults);
  await act(async()=>root.unmount());
  markFilterNavigation(sessionStorage,'/builders/bellway','/developments',window.location.origin);
  setIncomingPageFilters('/developments',{region:'Bellway'});
  window.history.replaceState(null,'','/developments');root=createRoot(container);
  await act(async()=>root.render(<Page/>));
  expect(JSON.parse(container.textContent!)).toEqual({...defaults,region:'Bellway'});
  expect(window.location.search).toBe('');
 }finally{await act(async()=>root.unmount());container.remove();sessionStorage.clear();window.history.replaceState(null,'','/');vi.unstubAllGlobals();}
});
