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
