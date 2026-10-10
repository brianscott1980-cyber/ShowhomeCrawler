// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {ImageCardTags,cardTags,fittingTagCount} from '../src/web/image-card-tags';
import type {ImageCategorisation} from '../src/reports/report';
it('routes shared wall and furnishing colours to the scoped furnishing filter',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const container=document.createElement('div'),root=createRoot(container);
 const furnishing=vi.fn(),interior=vi.fn(),tag=vi.fn();
 const category={colours:['Black'],interiorColours:[{surface:'walls',colours:['Black'],prominence:'dominant'}],furnishings:[{object:'alarm clock',colours:['White'],prominence:'accent'}]} as ImageCategorisation;
 try{
  await act(async()=>root.render(<ImageCardTags furnishingColourScope category={category} selected={c=>c==='Black'} interiorSelected={()=>false} onTag={tag} onInteriorColour={interior} onFurnishingColour={furnishing}/>));
  const black=Array.from(container.querySelectorAll<HTMLButtonElement>('.image-card-tag-row > button')).find(b=>b.textContent==='Black')!;
  await act(async()=>black.click());
  expect(furnishing).toHaveBeenCalledWith('Black');
  expect(interior).not.toHaveBeenCalled();expect(tag).not.toHaveBeenCalled();
  expect(black.getAttribute('aria-pressed')).toBe('true');
 }finally{await act(async()=>root.unmount());vi.unstubAllGlobals();}
});
it('fills three card tags and filters remaining tags without opening the card',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const show=vi.fn(function(this:HTMLDialogElement){this.setAttribute('open','');});
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:show});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.removeAttribute('open');this.dispatchEvent(new Event('close'));}});
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container),select=vi.fn(),tagSelect=vi.fn(),galleryOpen=vi.fn();
 const category={colours:['Red'],interiorColours:[{surface:'walls',colours:['blue',' Blue '],prominence:'dominant'},{surface:'floor',colours:['Beige'],prominence:'secondary'}],furnishings:[{object:'Chair',colours:['Brown'],prominence:'accent'}],decor:['Blue','Artwork'],hasTelevision:true} as ImageCategorisation;
 try{
  await act(async()=>root.render(<article onClick={galleryOpen}><ImageCardTags category={category} selected={()=>false} interiorSelected={()=>false} onTag={tagSelect} onInteriorColour={select}/></article>));
  expect(Array.from(container.querySelectorAll('.image-card-tag-row > button')).map(button=>button.textContent).join('')).toBe('BlueBeigeBrown+');expect(container.querySelector('dialog')).toBeNull();
  await act(async()=>container.querySelector<HTMLButtonElement>('.tag-colour')!.click());expect(select).toHaveBeenCalledWith('Blue');
  const more=container.querySelector<HTMLButtonElement>('.image-tags-more')!;
  await act(async()=>more.click());expect(show).toHaveBeenCalledOnce();
  const dialog=container.querySelector('dialog')!;expect(dialog.open).toBe(true);
  const labels=Array.from(dialog.querySelectorAll('.tag')).map(t=>t.textContent);
  expect(labels).toEqual(expect.arrayContaining(['Chair','Red','Artwork','Television']));expect(labels).not.toContain('Blue');
  await act(async()=>Array.from(dialog.querySelectorAll<HTMLButtonElement>('.tag')).find(t=>t.textContent==='Chair')!.click());
  expect(tagSelect).toHaveBeenCalledWith('Chair');expect(galleryOpen).not.toHaveBeenCalled();
  expect(container.querySelector('dialog')).toBeNull();expect(document.activeElement).toBe(more);
 }finally{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();}
});
it('uses legacy colours when structured colours are absent and keeps excess primary colours accessible',()=>{
 const legacy=cardTags({colours:['Blue','White','Grey','Pink'],objects:['Chair']} as ImageCategorisation);
 expect(legacy.primary).toEqual(['Blue','White','Grey']);expect(legacy.remaining).toEqual(expect.arrayContaining(['Pink','Chair']));
 const structured=cardTags({interiorColours:[{surface:'walls',colours:['Blue','White','Grey','Pink'],prominence:'dominant'}],colours:['Brown']} as ImageCategorisation);
 expect(structured.primary).toEqual(['Blue','White','Grey']);expect(structured.remaining).toEqual(expect.arrayContaining(['Pink','Brown']));
});

it('fits one row while reserving room for more tags, including resizing and all-tags-fit cases',()=>{
 expect(fittingTagCount(250,[50,60,40,45,70],5,28)).toBe(4);
 expect(fittingTagCount(120,[50,60,40,45,70],5,28)).toBe(1);
 expect(fittingTagCount(400,[50,60,40,45,70],5,28)).toBe(5);
 expect(fittingTagCount(40,[100],5,28)).toBe(0);
});
