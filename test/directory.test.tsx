import {describe,it,expect,vi,afterEach} from 'vitest';
import {JSDOM} from 'jsdom';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {DeveloperDirectory,orderedDevelopers,distanceMiles,type DeveloperCard} from '../src/web/directory';
import {SiteDirectory} from '../src/web/site-directory';
import type {SiteCard} from '../src/web/site-filters';
import {Navigation} from '../src/web/navigation';
import {GET} from '../src/app/api/location/route';
const cards:DeveloperCard[]=[{slug:'a',name:'Alpha',spaces:2,image:'a.jpg',description:'Office',locations:[{name:'Far',latitude:56,longitude:0},{name:'Near',latitude:51,longitude:0}]},{slug:'b',name:'Beta',spaces:9,image:'b.jpg',description:'Office',locations:[{name:'Other',latitude:52,longitude:0}]},{slug:'c',name:'Gamma',spaces:5,image:'c.jpg',description:'Office',locations:[]}];
afterEach(()=>{vi.unstubAllGlobals();});
describe('Developer directory',()=>{
 it('orders by spaces, name, and nearest development distance with unknown locations last',()=>{
  expect(orderedDevelopers(cards,'spaces',null).map(c=>c.slug)).toEqual(['b','c','a']);
  expect(orderedDevelopers(cards,'name',null).map(c=>c.slug)).toEqual(['a','b','c']);
  const ordered=orderedDevelopers(cards,'distance',{latitude:51,longitude:0});expect(ordered.map(c=>c.slug)).toEqual(['a','b','c']);expect(ordered[0]!.nearest?.name).toBe('Near');expect(distanceMiles({latitude:51,longitude:0},{latitude:52,longitude:0})).toBeCloseTo(69.09,1);
 });
 it('switches all three layouts and remembers the selected view',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'https://local.test'});vi.stubGlobal('window',dom.window);vi.stubGlobal('self',dom.window);vi.stubGlobal('document',dom.window.document);vi.stubGlobal('localStorage',dom.window.localStorage);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const root=createRoot(document.getElementById('root')!);
  try{await act(async()=>root.render(<DeveloperDirectory cards={cards}/>));for(const [label,layout] of [['List','list'],['Smaller grid','compact'],['Large cards','large']]){const button=[...document.querySelectorAll('button')].find(b=>b.textContent===label)!;expect(button.querySelector('svg')).not.toBeNull();await act(async()=>button.click());expect(button.getAttribute('aria-pressed')).toBe('true');expect(document.querySelector('.directory-'+layout)).not.toBeNull();expect(localStorage.getItem('showhome-directory-view')).toBe(layout);}}finally{await act(async()=>root.unmount());dom.window.close();}
 });
 it('switches layouts with thumbnail icons in SiteDirectory',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'https://local.test'});vi.stubGlobal('window',dom.window);vi.stubGlobal('self',dom.window);vi.stubGlobal('document',dom.window.document);vi.stubGlobal('localStorage',dom.window.localStorage);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const root=createRoot(document.getElementById('root')!);
  const siteCard:SiteCard={key:'k1',name:'Loc',developer:'Dev',image:'/img.jpg',description:'Desc',count:1,country:'UK',latitude:51,longitude:0,properties:[]};
  try{await act(async()=>root.render(<SiteDirectory cards={[siteCard]}/>));for(const [label,layout] of [['List','list'],['Smaller grid','compact'],['Large cards','large']]){const button=[...document.querySelectorAll('button')].find(b=>b.textContent===label)!;expect(button.querySelector('svg')).not.toBeNull();await act(async()=>button.click());expect(button.getAttribute('aria-pressed')).toBe('true');expect(document.querySelector('.directory-'+layout)).not.toBeNull();}}finally{await act(async()=>root.unmount());dom.window.close();}
 });
 it('updates the header badge after favourite changes without double-counting duplicate IDs',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'https://local.test'});vi.stubGlobal('window',dom.window);vi.stubGlobal('self',dom.window);vi.stubGlobal('document',dom.window.document);vi.stubGlobal('localStorage',dom.window.localStorage);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);localStorage.setItem('showhome-favourites-v1','["one","one","two"]');const root=createRoot(document.getElementById('root')!);
  try{await act(async()=>root.render(<Navigation/>));expect(document.querySelector('.favourites-count')?.textContent).toBe('2');await act(async()=>{localStorage.setItem('showhome-favourites-v1','[]');window.dispatchEvent(new dom.window.Event('showhome-favourites-changed'));});expect(document.querySelector('.favourites-count')?.textContent).toBe('0');}finally{await act(async()=>root.unmount());dom.window.close();}
 });
 it('requests browser location only on click and handles permission denial',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'https://local.test'});vi.stubGlobal('window',dom.window);vi.stubGlobal('self',dom.window);vi.stubGlobal('document',dom.window.document);vi.stubGlobal('localStorage',dom.window.localStorage);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const lookup=vi.fn((_success,fail)=>fail({code:1}));vi.stubGlobal('navigator',{geolocation:{getCurrentPosition:lookup}});const root=createRoot(document.getElementById('root')!);
  try{await act(async()=>root.render(<DeveloperDirectory cards={cards}/>));expect(lookup).not.toHaveBeenCalled();const select=document.querySelector('select')!;await act(async()=>{select.value='distance';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});expect(lookup).not.toHaveBeenCalled();await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Use my location')!.click());expect(lookup).toHaveBeenCalledOnce();expect(document.querySelector('[role=status]')?.textContent).toContain('permission was declined');}finally{await act(async()=>root.unmount());dom.window.close();}
 });
 it('rejects invalid postcodes without making a lookup request and handles lookup failures',async()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);expect((await GET(new Request('https://local.test/api/location?postcode=invalid'))).status).toBe(400);expect(fetcher).not.toHaveBeenCalled();fetcher.mockResolvedValue(Response.json({result:{postcode:'SW1A 1AA',latitude:51.501,longitude:-0.141}}));const response=await GET(new Request('https://local.test/api/location?postcode=SW1A1AA'));expect(await response.json()).toMatchObject({latitude:51.501,longitude:-0.141});expect(response.headers.get('Cache-Control')).toBe('no-store');fetcher.mockRejectedValue(new Error('Unavailable'));expect((await GET(new Request('https://local.test/api/location?postcode=SW1A1AA'))).status).toBe(502);
 });
});
