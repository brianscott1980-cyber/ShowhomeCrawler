// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {imageHomes,ImageHomesDialog} from '../src/web/image-homes-dialog';
import type {GalleryImage} from '../src/web/gallery-page-data';
it('combines repeated house/development memberships and sorts known distances before unknown ones',()=>{
 const homes=[{name:'Far',development:'Far',developmentUrl:'far',latitude:55,longitude:0},{name:'Unknown',development:'Unknown',developmentUrl:'unknown'},{name:'Near',development:'Near',developmentUrl:'near',latitude:51.1,longitude:0},{name:'Near',development:'Near',developmentUrl:'near',latitude:51.1,longitude:0}] as GalleryImage['homes'];
 expect(imageHomes(homes,{latitude:51,longitude:0}).map(home=>home.name)).toEqual(['Near','Far','Unknown']);
});
it('opens an accessible home dialog without opening the gallery and restores focus on close',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.setAttribute('open','');}});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.removeAttribute('open');this.dispatchEvent(new Event('close'));}});
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container),gallery=vi.fn();
 const image={slug:'builder',path:'images/example.jpg',homes:[{name:'The House',development:'Near',developmentUrl:'https://example.com/near',url:'https://example.com/home',latitude:51.1,longitude:0,bedrooms:3,price:null,plots:[]},{name:'Other House',development:'Far',developmentUrl:'far',url:'other',bedrooms:3,price:null,plots:[]}]} as GalleryImage;
 try{
  await act(async()=>root.render(<article onClick={gallery}><ImageHomesDialog image={image} location={{latitude:51,longitude:0}}/></article>));
  const trigger=container.querySelector<HTMLButtonElement>('.image-homes-trigger')!;
  await act(async()=>trigger.click());
  expect(container.querySelector('dialog')?.open).toBe(true);expect(container.textContent).toContain('6.9 miles');expect(container.querySelector('a')?.href).toBe('http://localhost:3000/buildings/builder/thehouse');
  await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="Close home associations"]')!.click());
  expect(container.querySelector('dialog')).toBeNull();expect(document.activeElement).toBe(trigger);expect(gallery).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();}
});

it('links directly to one building type even when it has multiple developments',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const container=document.createElement('div'),root=createRoot(container);
 const image={slug:'builder',path:'images/home.jpg',homes:[{name:'The House',development:'A',developmentUrl:'a',buildingHref:'/buildings/builder/house'},{name:'The House',development:'B',developmentUrl:'b',buildingHref:'/buildings/builder/house'}]} as GalleryImage;
 try{await act(async()=>root.render(<ImageHomesDialog image={image}/>));expect(container.querySelector('a')?.getAttribute('href')).toBe('/buildings/builder/house');expect(container.querySelector('button')).toBeNull();expect(container.querySelector('dialog')).toBeNull();}finally{await act(async()=>root.unmount());vi.unstubAllGlobals();}
});

 it('keeps the home link for house names with plot suffixes',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const container=document.createElement('div'),root=createRoot(container);
 const image={slug:'avant',path:'images/home.jpg',homes:[{name:'The Thoresby · Plot 25',buildingName:'The Thoresby',development:'A',developmentUrl:'a'}]} as GalleryImage;
 try{await act(async()=>root.render(<ImageHomesDialog image={image}/>));expect(container.querySelector('a')?.getAttribute('href')).toBe('/buildings/avant/thethoresby');expect(container.textContent).toContain('Explore this home');}finally{await act(async()=>root.unmount());vi.unstubAllGlobals();}
});

it('opens development previews on a building page even with a single development',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.setAttribute('open','');}});
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
 const image={slug:'miller-homes',path:'images/home.jpg',homes:[{name:'Beechmont',development:'A',developmentUrl:'a'}]} as GalleryImage;
 try{
  await act(async()=>root.render(<ImageHomesDialog image={image} developments={[{href:'/developments/green-park',name:'Green Park',image:'/preview.jpg',builderName:'Miller Homes'}]}/>));
  const trigger=container.querySelector<HTMLButtonElement>('button')!;
  expect(trigger.textContent).toBe('Explore developments');expect(trigger.querySelector('ellipse')).not.toBeNull();
  await act(async()=>trigger.click());
  expect(container.querySelector('dialog')?.open).toBe(true);expect(container.querySelector('a')?.getAttribute('href')).toBe('/developments/green-park');
  expect(container.textContent).toContain('Green Park');expect(container.textContent).not.toContain('Explore this home');expect(container.querySelector('.image-home-bedrooms')).toBeNull();
 }finally{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();}
});
