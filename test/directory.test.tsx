import {describe,it,expect,vi,afterEach} from 'vitest';
import {JSDOM} from 'jsdom';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {DeveloperDirectory,orderedDevelopers,distanceMiles,type DeveloperCard} from '../src/web/directory';
import {SiteDirectory} from '../src/web/site-directory';
import {GroupCards} from '../src/web/group-cards';
import type {SiteCard} from '../src/web/site-filters';
import {AccountMenu} from '../src/web/account-menu';
import {GET} from '../src/app/api/location/route';
const cards:DeveloperCard[]=[{slug:'a',name:'Alpha',spaces:2,image:'a.jpg',description:'Office',locations:[{name:'Far',latitude:56,longitude:0},{name:'Near',latitude:51,longitude:0}]},{slug:'b',name:'Beta',spaces:9,image:'b.jpg',description:'Office',locations:[{name:'Other',latitude:52,longitude:0}]},{slug:'c',name:'Gamma',spaces:5,image:'c.jpg',description:'Office',locations:[]}];
afterEach(()=>{vi.unstubAllGlobals();});
describe('Developer directory',()=>{
 it('orders by spaces, name, and nearest development distance with unknown locations last',()=>{
  expect(orderedDevelopers(cards,'spaces',null).map(c=>c.slug)).toEqual(['b','c','a']);
  expect(orderedDevelopers(cards,'name',null).map(c=>c.slug)).toEqual(['a','b','c']);
  const ordered=orderedDevelopers(cards,'distance',{latitude:51,longitude:0});expect(ordered.map(c=>c.slug)).toEqual(['a','b','c']);expect(ordered[0]!.nearest?.name).toBe('Near');expect(distanceMiles({latitude:51,longitude:0},{latitude:52,longitude:0})).toBeCloseTo(69.09,1);
 });
 it('defaults to ordering homebuilders by name A–Z',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'https://local.test'});vi.stubGlobal('window',dom.window);vi.stubGlobal('self',dom.window);vi.stubGlobal('document',dom.window.document);vi.stubGlobal('localStorage',dom.window.localStorage);vi.stubGlobal('sessionStorage',dom.window.sessionStorage);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const root=createRoot(document.getElementById('root')!);
  try{await act(async()=>root.render(<DeveloperDirectory cards={cards}/>));const select=document.querySelector('#directory-order') as HTMLSelectElement;expect(select.value).toBe('name');const cardTitles=[...document.querySelectorAll('.collection-card h2')].map(h=>h.textContent?.replace('↗','').trim());expect(cardTitles).toEqual(['Alpha','Beta','Gamma']);}finally{await act(async()=>root.unmount());dom.window.close();}
 });
 it('switches all three layouts, defaults to compact, and remembers the selected view in sessionStorage',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'https://local.test'});vi.stubGlobal('window',dom.window);vi.stubGlobal('self',dom.window);vi.stubGlobal('document',dom.window.document);vi.stubGlobal('localStorage',dom.window.localStorage);vi.stubGlobal('sessionStorage',dom.window.sessionStorage);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const root=createRoot(document.getElementById('root')!);
  try{await act(async()=>root.render(<DeveloperDirectory cards={cards}/>));expect(document.querySelector('.directory-compact')).not.toBeNull();for(const [label,layout] of [['Smaller grid','compact'],['Large cards','large'],['List','list']]){const button=[...document.querySelectorAll('button')].find(b=>b.textContent===label)!;expect(button.querySelector('svg')).not.toBeNull();await act(async()=>button.click());expect(button.getAttribute('aria-pressed')).toBe('true');expect(document.querySelector('.directory-'+layout)).not.toBeNull();expect(sessionStorage.getItem('showhome-homebuilders-view')).toBe(layout);}}finally{await act(async()=>root.unmount());dom.window.close();}
 });
 it('switches layouts with thumbnail icons in SiteDirectory, defaults to list, and saves to sessionStorage',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'https://local.test'});vi.stubGlobal('window',dom.window);vi.stubGlobal('self',dom.window);vi.stubGlobal('document',dom.window.document);vi.stubGlobal('localStorage',dom.window.localStorage);vi.stubGlobal('sessionStorage',dom.window.sessionStorage);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const root=createRoot(document.getElementById('root')!);
  const siteCard:SiteCard={key:'k1',name:'Loc',developer:'Dev',image:'/img.jpg',description:'Desc',count:1,country:'UK',latitude:51,longitude:0,properties:[]};
  try{await act(async()=>root.render(<SiteDirectory cards={[siteCard]}/>));expect(document.querySelector('.directory-list')).not.toBeNull();for(const [label,layout] of [['Smaller grid','compact'],['Large cards','large'],['List','list']]){const button=[...document.querySelectorAll('button')].find(b=>b.textContent===label)!;expect(button.querySelector('svg')).not.toBeNull();await act(async()=>button.click());expect(button.getAttribute('aria-pressed')).toBe('true');expect(document.querySelector('.directory-'+layout)).not.toBeNull();expect(sessionStorage.getItem('showhome-locations-view')).toBe(layout);}}finally{await act(async()=>root.unmount());dom.window.close();}
 });
 it('defaults Interiors to large card and Buildings to small card (compact), persisting in sessionStorage',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'https://local.test'});vi.stubGlobal('window',dom.window);vi.stubGlobal('self',dom.window);vi.stubGlobal('document',dom.window.document);vi.stubGlobal('localStorage',dom.window.localStorage);vi.stubGlobal('sessionStorage',dom.window.sessionStorage);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const root=createRoot(document.getElementById('root')!);
  const groupItems=[{key:'living-room',name:'Living Room',developers:['Alpha'],count:3,image:'/img.jpg',description:'Living Room'}];
  try{
   await act(async()=>root.render(<GroupCards key="interiors" cards={groupItems} pathPrefix="interiors" kindLabel="Interiors"/>));
   expect(document.querySelector('.directory-large')).not.toBeNull();
   const listBtn=[...document.querySelectorAll('button')].find(b=>b.textContent==='List')!;
   await act(async()=>listBtn.click());
   expect(document.querySelector('.directory-list')).not.toBeNull();
   expect(sessionStorage.getItem('showhome-interiors-view')).toBe('list');

   await act(async()=>root.render(<GroupCards key="buildings" cards={groupItems} pathPrefix="buildings" kindLabel="Buildings"/>));
   expect(document.querySelector('.directory-compact')).not.toBeNull();
   const largeBtn=[...document.querySelectorAll('button')].find(b=>b.textContent==='Large cards')!;
   await act(async()=>largeBtn.click());
   expect(document.querySelector('.directory-large')).not.toBeNull();
   expect(sessionStorage.getItem('showhome-buildings-view')).toBe('large');
  }finally{await act(async()=>root.unmount());dom.window.close();}
 });
 it('prefixes Interiors cards with All Room Types card only when more than 1 room type is returned',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'https://local.test'});
  class MockIntersectionObserver { observe() {} unobserve() {} disconnect() {} }
  vi.stubGlobal('window',dom.window);vi.stubGlobal('self',dom.window);vi.stubGlobal('document',dom.window.document);
  vi.stubGlobal('HTMLElement',dom.window.HTMLElement);vi.stubGlobal('localStorage',dom.window.localStorage);
  vi.stubGlobal('sessionStorage',dom.window.sessionStorage);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.stubGlobal('IntersectionObserver',MockIntersectionObserver);
  vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>setTimeout(cb,0));
  vi.stubGlobal('cancelAnimationFrame',(id:number)=>clearTimeout(id));
  const root=createRoot(document.getElementById('root')!);
  const multipleRooms=[
   {key:'bathroom',name:'Bathroom',developers:['Alpha'],count:5,image:'/bath.jpg',description:'Bath'},
   {key:'bedroom',name:'Bedroom',developers:['Alpha'],count:8,image:'/bed.jpg',description:'Bed'},
  ];
  const singleRoom=[
   {key:'bathroom',name:'Bathroom',developers:['Alpha'],count:5,image:'/bath.jpg',description:'Bath'},
  ];
  try{
   await act(async()=>root.render(<GroupCards cards={multipleRooms} pathPrefix="interiors" kindLabel="Interiors"/>));
   const cardHeadings=[...document.querySelectorAll('.collection-card h2')].map(h=>h.textContent?.trim());
   expect(cardHeadings[0]).toBe('All Room Types');
   expect(cardHeadings).toEqual(['All Room Types','Bathroom','Bedroom']);
   const allCard=document.querySelector('.collection-card') as HTMLAnchorElement;
   expect(allCard.getAttribute('href')).toBe('/interiors/all');

   await act(async()=>root.render(<GroupCards cards={singleRoom} pathPrefix="interiors" kindLabel="Interiors"/>));
   const singleHeadings=[...document.querySelectorAll('.collection-card h2')].map(h=>h.textContent?.trim());
   expect(singleHeadings).toEqual(['Bathroom']);
   expect(singleHeadings).not.toContain('All Room Types');
  }finally{await act(async()=>root.unmount());dom.window.close();}
 });
 it('filters Buildings by Homebuilder, Bedrooms, and Locations with reset functionality',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'https://local.test'});vi.stubGlobal('window',dom.window);vi.stubGlobal('self',dom.window);vi.stubGlobal('document',dom.window.document);vi.stubGlobal('localStorage',dom.window.localStorage);vi.stubGlobal('sessionStorage',dom.window.sessionStorage);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const root=createRoot(document.getElementById('root')!);
  const buildingCards=[
   {key:'b1',name:'Alford',developers:['Miller Homes'],count:2,image:'/1.jpg',description:'Desc',bedrooms:[5],locations:['Shawfair'],places:[{site:'Test site',locations:['Shawfair']}]},
   {key:'b2',name:'Beechford',developers:['Miller Homes'],count:4,image:'/2.jpg',description:'Desc',bedrooms:[4,5],locations:['Langley Gate','City Fields'],places:[{site:'Test site',locations:['Langley Gate','City Fields']}]},
   {key:'b3',name:'Cheltenham',developers:['Barratt'],count:3,image:'/3.jpg',description:'Desc',bedrooms:[4],locations:['Langley Gate'],places:[{site:'Test site',locations:['Langley Gate']}]},
  ];
  try{
   await act(async()=>root.render(<GroupCards cards={buildingCards} pathPrefix="buildings" kindLabel="Buildings"/>));
   expect(document.querySelectorAll('.collection-card')).toHaveLength(3);

   const choose=async(label:string,option:string)=>{
    const filter=[...document.querySelectorAll('.multi-filter')].find(node=>node.querySelector(':scope>span')?.textContent===label)!;
    const row=[...filter.querySelectorAll('label')].find(node=>node.querySelector('span')?.textContent===option)!;
    await act(async()=>row.querySelector<HTMLInputElement>('input')!.click());
   };
   expect(document.querySelectorAll('.multi-filter')).toHaveLength(5);
   await choose('Builders','Miller Homes');
   expect(document.querySelectorAll('.collection-card')).toHaveLength(2);
   await choose('Bedrooms','4 bedrooms');
   expect(document.querySelectorAll('.collection-card')).toHaveLength(1);
   expect(document.querySelector('.collection-card h2')?.textContent).toContain('Beechford');
   await choose('Areas','Langley Gate');
   expect(document.querySelectorAll('.collection-card')).toHaveLength(1);
   const resetBtn=[...document.querySelectorAll('button')].find(b=>b.textContent==='Reset filters')!;
   await act(async()=>resetBtn.click());
   expect(document.querySelectorAll('.collection-card')).toHaveLength(3);
   await act(async()=>{window.history.replaceState(null,'','?location=City+Fields&bedrooms=4&developer=Barratt');window.dispatchEvent(new dom.window.PopStateEvent('popstate'));});
   expect(document.querySelectorAll('.collection-card')).toHaveLength(0);
   expect(document.querySelector('.empty')?.textContent).toContain('No buildings match these filters');
  }finally{await act(async()=>root.unmount());dom.window.close();}
 });
 it('updates the header badge after favourite changes without double-counting duplicate IDs',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'https://local.test'});vi.stubGlobal('window',dom.window);vi.stubGlobal('self',dom.window);vi.stubGlobal('document',dom.window.document);vi.stubGlobal('localStorage',dom.window.localStorage);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);localStorage.setItem('showhome-favourites-v1','["one","one","two"]');const root=createRoot(document.getElementById('root')!);
  try{await act(async()=>root.render(<AccountMenu/>));expect(document.querySelector('.favourites-count')?.textContent).toBe('2');await act(async()=>{localStorage.setItem('showhome-favourites-v1','[]');window.dispatchEvent(new dom.window.Event('showhome-favourites-changed'));});expect(document.querySelector('.favourites-count')?.textContent).toBe('0');}finally{await act(async()=>root.unmount());dom.window.close();}
 });
 it('rejects invalid postcodes without making a lookup request and handles lookup failures',async()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);expect((await GET(new Request('https://local.test/api/location?postcode=invalid'))).status).toBe(400);expect(fetcher).not.toHaveBeenCalled();fetcher.mockResolvedValue(Response.json({result:{postcode:'SW1A 1AA',latitude:51.501,longitude:-0.141}}));const response=await GET(new Request('https://local.test/api/location?postcode=SW1A1AA'));expect(await response.json()).toMatchObject({latitude:51.501,longitude:-0.141});expect(response.headers.get('Cache-Control')).toBe('no-store');fetcher.mockRejectedValue(new Error('Unavailable'));expect((await GET(new Request('https://local.test/api/location?postcode=SW1A1AA'))).status).toBe(502);
 });
});
