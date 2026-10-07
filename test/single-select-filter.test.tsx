// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {SingleSelectFilter} from '../src/web/single-select-filter';
it('uses a floating menu, supports keyboard choices and closes on selection',async()=>{
 vi.stubEnv('NEXT_PUBLIC_CASCADING_FILTERS','true');vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const host=document.createElement('div');document.body.append(host);const root=createRoot(host),change=vi.fn();
 try{
  await act(async()=>root.render(<SingleSelectFilter label="Maximum bedrooms" value="" options={[{value:'',label:'Any'},{value:'5',label:'5 beds'},{value:'6',label:'6 beds'}]} onChange={change}/>));
  expect(host.querySelector('select')).toBeNull();
  const summary=host.querySelector('summary')!;
  await act(async()=>summary.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})));
  expect(host.querySelector('details')!.open).toBe(true);
  expect(document.activeElement?.getAttribute('role')).toBe('option');
  await act(async()=>host.querySelectorAll<HTMLButtonElement>('[role="option"]')[1]!.click());
  expect(change).toHaveBeenCalledWith('5');expect(host.querySelector('details')!.open).toBe(false);expect(document.activeElement).toBe(summary);
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.unstubAllEnvs();}
});
