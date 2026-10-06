// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {CardResults} from '../src/web/card-results';
it('appends four rows without replacing earlier cards and resets for new criteria',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 vi.spyOn(window,'getComputedStyle').mockReturnValue({gridTemplateColumns:'200px 200px 200px 200px'} as CSSStyleDeclaration);
 const mount=document.createElement('div');document.body.append(mount);const root=createRoot(mount);
 const render=(identity:string)=>root.render(<CardResults className="collection-grid" label="Builders" identity={identity}>{Array.from({length:35},(_,i)=><article key={i}>{i}</article>)}</CardResults>);
 try{
  await act(async()=>render('all'));
  expect(mount.querySelectorAll('article')).toHaveLength(16);
  const first=mount.querySelector('article');
  await act(async()=>mount.querySelector<HTMLButtonElement>('button')!.click());
  expect(mount.querySelectorAll('article')).toHaveLength(32);expect(mount.querySelector('article')).toBe(first);
  await act(async()=>mount.querySelector<HTMLButtonElement>('button')!.click());
  expect(mount.querySelectorAll('article')).toHaveLength(35);expect(mount.querySelector('button')).toBeNull();
  await act(async()=>render('radius25'));expect(mount.querySelectorAll('article')).toHaveLength(16);
 }finally{await act(async()=>root.unmount());mount.remove();vi.restoreAllMocks();vi.unstubAllGlobals();}
});

it('fills only at the bottom, resets on reverse scrolling and loads once per pressure gesture',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 vi.spyOn(window,'getComputedStyle').mockReturnValue({gridTemplateColumns:'200px 200px 200px 200px',overflowY:'visible'} as CSSStyleDeclaration);
 let y=0;
 vi.spyOn(window,'scrollY','get').mockImplementation(()=>y);
 vi.spyOn(window,'innerHeight','get').mockReturnValue(800);
 vi.spyOn(document.documentElement,'scrollHeight','get').mockReturnValue(1800);
 vi.spyOn(performance,'now').mockReturnValue(2000);
 const mount=document.createElement('div');document.body.append(mount);const root=createRoot(mount);
 const wheel=async(deltaY:number)=>act(async()=>{window.dispatchEvent(new WheelEvent('wheel',{deltaY}));});
 try{
  await act(async()=>root.render(<CardResults className="collection-grid" label="Developments" identity="all">{Array.from({length:40},(_,i)=><article key={i}>{i}</article>)}</CardResults>));
  const button=mount.querySelector<HTMLButtonElement>('button')!;
  vi.spyOn(button,'getBoundingClientRect').mockReturnValue({top:650,bottom:710} as DOMRect);
  await wheel(480);expect(mount.querySelectorAll('article')).toHaveLength(16);
  expect(mount.querySelector<SVGElement>('.more-pressure-fill')!.style.transform).toBe('scale(0)');
  y=1000;
  await wheel(60);await wheel(60);await wheel(60);
  expect(mount.querySelector<SVGElement>('.more-pressure-fill')!.style.transform).toBe('scale(0.75)');
  expect(mount.querySelector<HTMLElement>('.more-pressure')!.style.transform).not.toBe('scale(1)');
  await wheel(-10);
  expect(mount.querySelector<SVGElement>('.more-pressure-fill')!.style.transform).toBe('scale(0)');
  for(let i=0;i<2;i++)await wheel(120);
  expect(mount.querySelectorAll('article')).toHaveLength(32);
  for(let i=0;i<8;i++)await wheel(120);
  expect(mount.querySelectorAll('article')).toHaveLength(32);
  await act(async()=>button.click());
  expect(mount.querySelectorAll('article')).toHaveLength(40);expect(mount.querySelector('button')).toBeNull();
 }finally{await act(async()=>root.unmount());mount.remove();vi.restoreAllMocks();vi.unstubAllGlobals();}
});
it('tops up leftover server cards to complete four more rows of three',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 vi.spyOn(window,'getComputedStyle').mockReturnValue({gridTemplateColumns:'200px 200px 200px'} as CSSStyleDeclaration);
 const mount=document.createElement('div');document.body.append(mount);const root=createRoot(mount),load=vi.fn();
 const render=(count:number)=>root.render(<CardResults className="image-grid" label="Interiors" identity="all" hasMore onLoadMore={load}>{Array.from({length:count},(_,i)=><article key={i}>{i}</article>)}</CardResults>);
 try{
  await act(async()=>render(16));expect(mount.querySelectorAll('article')).toHaveLength(12);
  await act(async()=>mount.querySelector<HTMLButtonElement>('button')!.click());expect(load).toHaveBeenLastCalledWith(8);
  await act(async()=>render(24));expect(mount.querySelectorAll('article')).toHaveLength(24);
  await act(async()=>mount.querySelector<HTMLButtonElement>('button')!.click());expect(load).toHaveBeenLastCalledWith(12);
 }finally{await act(async()=>root.unmount());mount.remove();vi.restoreAllMocks();vi.unstubAllGlobals();}
});

it('replaces previous filter results with logo skeletons but preserves cards when appending',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 vi.spyOn(window,'getComputedStyle').mockReturnValue({gridTemplateColumns:'200px 200px 200px'} as CSSStyleDeclaration);
 const mount=document.createElement('div');document.body.append(mount);const root=createRoot(mount);
 const render=(replacing:boolean,loading:boolean,identity='all')=>root.render(<CardResults className="collection-grid" label="Buildings" identity={identity} replacing={replacing} loading={loading} hasMore>{Array.from({length:6},(_,i)=><article key={i}>Previous result {i}</article>)}</CardResults>);
 try{
  await act(async()=>render(false,false));expect(mount.querySelectorAll('article')).toHaveLength(6);
  await act(async()=>render(true,true,'filtered'));
  expect(mount.querySelectorAll('article')).toHaveLength(0);
  expect(mount.querySelectorAll('.result-loading-card')).toHaveLength(6);
  expect(mount.querySelectorAll('.card-image-loading')).toHaveLength(6);
  expect(mount.querySelector('button')).toBeNull();
  await act(async()=>render(false,false,'filtered'));
  expect(mount.querySelectorAll('.result-loading-card')).toHaveLength(0);
  const first=mount.querySelector('article');
  await act(async()=>render(false,true,'filtered'));
  expect(mount.querySelector('article')).toBe(first);
  expect(mount.querySelector<HTMLButtonElement>('button')?.disabled).toBe(true);
 }finally{await act(async()=>root.unmount());mount.remove();vi.restoreAllMocks();vi.unstubAllGlobals();}
});
