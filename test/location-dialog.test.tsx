// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {DeveloperDirectory,type DeveloperCard} from '../src/web/directory';
import {saveLocation,readGuestLocation} from '../src/web/location-preferences';
vi.mock('../src/auth/browser',()=>({authClient:async()=>{throw new Error('Guest');}}));
const cards:DeveloperCard[]=[{slug:'one',name:'One',spaces:1,image:'/one.jpg',description:'One',locations:[{name:'Site',region:'London',latitude:51.5,longitude:-0.1}]}];
let root:Root,host:HTMLDivElement;
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(){this.setAttribute('open','');}});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(){this.removeAttribute('open');this.dispatchEvent(new Event('close'));}});
 localStorage.clear();sessionStorage.clear();window.history.replaceState(null,'','/');host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();localStorage.clear();vi.unstubAllGlobals();});
const request=async()=>{await act(async()=>{Array.from(host.querySelectorAll<HTMLButtonElement>('.distance-filter-options button')).find(button=>button.textContent==='25 miles')!.click();});};
it('has no location request in the filter bar and asks only when a distance feature is chosen',async()=>{
 const lookup=vi.fn();vi.stubGlobal('navigator',{geolocation:{getCurrentPosition:lookup}});
 await act(async()=>root.render(<DeveloperDirectory cards={cards}/>));
 expect(host.querySelector('.builder-filter-panel input[autoComplete="postal-code"]')).toBeNull();expect(host.querySelector('dialog[open]')).toBeNull();expect(lookup).not.toHaveBeenCalled();
 await request();expect(host.querySelector('dialog[open]')).not.toBeNull();expect(host.querySelector('dialog')?.textContent).toContain('24 hours');expect(host.querySelector('dialog')?.textContent).toContain('Sign up');expect(lookup).not.toHaveBeenCalled();
 await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Close location dialog"]')!.click());expect(host.querySelector('dialog[open]')).toBeNull();expect(new URLSearchParams(window.location.search).get('radius')).toBeNull();
});
it('requests device permission on the dialog button and keeps postcode available after denial',async()=>{
 const lookup=vi.fn((_success,fail)=>fail({code:1}));vi.stubGlobal('navigator',{geolocation:{getCurrentPosition:lookup}});
 await act(async()=>root.render(<DeveloperDirectory cards={cards}/>));await request();
 await act(async()=>host.querySelector<HTMLButtonElement>('.location-request-device')!.click());expect(lookup).toHaveBeenCalledOnce();expect(host.querySelector('dialog [role=status]')?.textContent).toContain('permission was declined');expect(host.querySelector('dialog[open]')).not.toBeNull();expect(readGuestLocation()).toBeNull();
});
it('saves a postcode for 24 hours and completes the original distance selection',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({postcode:'SW1A 1AA',latitude:51.5,longitude:-0.1})));
 await act(async()=>root.render(<DeveloperDirectory cards={cards}/>));await request();
 const input=host.querySelector<HTMLInputElement>('#location-request-postcode')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'SW1A 1AA');input.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>host.querySelector('dialog form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(readGuestLocation()?.postcode).toBe('SW1A 1AA');expect(host.querySelector('dialog[open]')).toBeNull();expect(new URLSearchParams(window.location.search).get('radius')).toBe('25');
});
it('reuses a saved location without asking again',async()=>{
 await saveLocation({latitude:51.5,longitude:-0.1,postcode:'SW1A 1AA',source:'postcode'});
 await act(async()=>root.render(<DeveloperDirectory cards={cards}/>));await request();expect(host.querySelector('dialog[open]')).toBeNull();expect(new URLSearchParams(window.location.search).get('radius')).toBe('25');
});
it('opens the same dialog for nearest-first ordering',async()=>{
 await act(async()=>root.render(<DeveloperDirectory cards={cards}/>));const select=host.querySelector<HTMLSelectElement>('#directory-order')!;await act(async()=>{select.value='distance';select.dispatchEvent(new Event('change',{bubbles:true}));});expect(host.querySelector('dialog[open]')).not.toBeNull();expect(select.value).toBe('name');
});

it('resumes the original radius request after authentication returns',async()=>{
 await saveLocation({latitude:51.5,longitude:-0.1,postcode:'SW1A 1AA',source:'postcode'});
 sessionStorage.setItem('showhome-location-request',JSON.stringify({path:'/',intent:{key:'radius',value:'25'},postcode:'',created:Date.now()}));
 await act(async()=>root.render(<DeveloperDirectory cards={cards}/>));
 expect(new URLSearchParams(window.location.search).get('radius')).toBe('25');
 expect(host.querySelector('dialog[open]')).toBeNull();
 expect(sessionStorage.getItem('showhome-location-request')).toBeNull();
});
it('returns to the dialog with the postcode draft when the account has no saved location',async()=>{
 sessionStorage.setItem('showhome-location-request',JSON.stringify({path:'/',intent:{key:'radius',value:'50'},postcode:'SW1A 1AA',created:Date.now()}));
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({postcode:'SW1A 1AA',latitude:51.5,longitude:-0.1})));
 await act(async()=>root.render(<DeveloperDirectory cards={cards}/>));
 expect(host.querySelector('dialog[open]')).not.toBeNull();
 expect(host.querySelector<HTMLInputElement>('#location-request-postcode')?.value).toBe('SW1A 1AA');
 await act(async()=>host.querySelector('dialog form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(new URLSearchParams(window.location.search).get('radius')).toBe('50');
});
it('offers separate sign-up and sign-in controls with providers inside the dialog',async()=>{
 await act(async()=>root.render(<DeveloperDirectory cards={cards}/>));await request();
 const buttons=Array.from(host.querySelectorAll<HTMLButtonElement>('dialog button'));
 expect(buttons.some(button=>button.textContent==='Sign up')).toBe(true);
 await act(async()=>buttons.find(button=>button.textContent==='Sign in')!.click());
 expect(host.querySelector('.location-auth-providers')?.textContent).toContain('Sign in to continue your search');
 expect(host.querySelector('.location-auth-providers')?.textContent).toContain('Continue with Google');
});

it('changes an existing location in place while retaining the selected radius',async()=>{
 await saveLocation({latitude:51.5,longitude:-0.1,postcode:'SW1A 1AA',area:'Westminster',source:'postcode'});
 await act(async()=>root.render(<DeveloperDirectory cards={cards}/>));await request();
 expect(host.querySelector('.distance-filter-location')?.textContent).toContain('Westminster');
 await act(async()=>host.querySelector<HTMLButtonElement>('.distance-filter-location button')!.click());
 expect(host.querySelector('dialog[open]')).not.toBeNull();
 expect(host.querySelector<HTMLInputElement>('#location-request-postcode')?.value).toBe('SW1A 1AA');
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({postcode:'EH1 1AA',area:'Edinburgh',latitude:55.95,longitude:-3.19})));
 await act(async()=>host.querySelector('dialog form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(host.querySelector('dialog[open]')).toBeNull();
 expect(host.querySelector('.distance-filter-location')?.textContent).toContain('Edinburgh');
 expect(new URLSearchParams(window.location.search).get('radius')).toBe('25');
});
