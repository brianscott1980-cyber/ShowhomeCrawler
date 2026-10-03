import {describe,it,expect,vi,afterEach} from 'vitest';
import {JSDOM} from 'jsdom';
import {act,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {SiteDirectory} from '../src/web/site-directory';
import type {SiteCard} from '../src/web/site-filters';
vi.mock('../src/web/site-map',async importOriginal=>{
 const actual=await importOriginal<typeof import('../src/web/site-map')>();
 return {...actual,SiteMap:({cards,activeKey,onSelect,onBoundsChange,onCameraChange,onVisibleSitesChange}:any)=>{useEffect(()=>onVisibleSitesChange(cards.map((card:SiteCard)=>card.key)),[cards,onVisibleSitesChange]);return <aside data-testid="map" data-selected={activeKey??''}><button onClick={()=>onSelect('one')}>Select map dot</button><button onClick={()=>{onBoundsChange({west:-1,east:1,south:50,north:52});onVisibleSitesChange(['one']);onCameraChange({lat:51,lng:0,zoom:9});}}>Move map</button></aside>;}};
});
const cards:SiteCard[]=[{key:'one',name:'Southern Gardens',developer:'Bellway',image:'/one.jpg',description:'Kitchen',count:2,country:'England',latitude:51,longitude:0,properties:[]},{key:'two',name:'Northern Gardens',developer:'Cala',image:'/two.jpg',description:'Living room',count:3,country:'Scotland',latitude:55,longitude:-4,properties:[]}];
afterEach(()=>vi.unstubAllGlobals());
describe('Locations explorer',()=>{
 it('loads the map on demand, filters its viewport and synchronises selections in both directions',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'https://local.test/locations'});
  for(const [key,value] of Object.entries({window:dom.window,self:dom.window,document:dom.window.document,sessionStorage:dom.window.sessionStorage,HTMLElement:dom.window.HTMLElement,requestAnimationFrame:(callback:()=>void)=>{callback();return 1;},IS_REACT_ACT_ENVIRONMENT:true}))vi.stubGlobal(key,value);
  const root=createRoot(document.getElementById('root')!);
  try{
   await act(async()=>root.render(<SiteDirectory cards={cards}/>));
   expect(document.querySelector('[data-testid="map"]')).toBeNull();
   await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="Map"]')!.click());
   expect(document.querySelector('[data-testid="map"]')).not.toBeNull();
   await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="Select Northern Gardens on map"]')!.click());
   expect(document.querySelector('[data-testid="map"]')?.getAttribute('data-selected')).toBe('two');
   const button=(text:string)=>[...document.querySelectorAll('button')].find(b=>b.textContent===text)!;
   await act(async()=>button('Select map dot').click());
   expect(document.querySelector('#site-card-one')?.classList.contains('is-map-active')).toBe(true);
   await act(async()=>button('Move map').click());
   expect(document.querySelectorAll('.collection-card')).toHaveLength(1);
   expect(window.location.search).toContain('zoom=9.00');
   const explore=document.querySelector<HTMLAnchorElement>('.site-explore-link')!;
   expect(explore.href).not.toContain('selected=');
   expect(explore.href).not.toContain('zoom=');
   await act(async()=>button('Reset filters').click());
   expect(document.querySelector('[data-testid="map"]')).not.toBeNull();
   expect(window.location.search).toContain('zoom=9.00');
   await act(async()=>button('List').click());
   expect(document.querySelector('[data-testid="map"]')).toBeNull();
   expect(document.querySelectorAll('.collection-card')).toHaveLength(2);
  }finally{await act(async()=>root.unmount());dom.window.close();}
 });
});
