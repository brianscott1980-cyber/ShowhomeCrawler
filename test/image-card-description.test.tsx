// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {ImageCardDescription} from '../src/web/image-card-description';
it('offers expansion only for overflowing descriptions and can collapse again',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const container=document.createElement('div'),root=createRoot(container);
 const height=vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(60),scroll=vi.spyOn(HTMLElement.prototype,'scrollHeight','get').mockReturnValue(120);
 try{
  await act(async()=>root.render(<ImageCardDescription text="A long description"/>));
  const button=container.querySelector('button')!;
  expect(button.textContent).toBe('Show more');expect(button.getAttribute('aria-expanded')).toBe('false');
  await act(async()=>button.click());expect(container.querySelector('p')?.classList.contains('is-expanded')).toBe(true);expect(button.textContent).toBe('Show less');
  await act(async()=>button.click());expect(container.querySelector('p')?.classList.contains('is-expanded')).toBe(false);
  scroll.mockReturnValue(60);
  await act(async()=>root.render(<ImageCardDescription text="Short description"/>));expect(container.querySelector('button')).toBeNull();
 }finally{await act(async()=>root.unmount());height.mockRestore();scroll.mockRestore();vi.unstubAllGlobals();}
});
