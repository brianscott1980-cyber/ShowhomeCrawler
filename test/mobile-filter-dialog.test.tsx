// @vitest-environment jsdom
import {act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {DirectoryFilters} from '../src/web/directory-filters';
import {MultiSelectFilter} from '../src/web/multi-select-filter';
it('applies choices immediately and retains them after closing the mobile dialog',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new Event('close'));};
 function Page(){const [value,setValue]=useState('');return <main><DirectoryFilters><MultiSelectFilter label="Builders" value={value} options={['Bellway','Cala']} onChange={setValue}/></DirectoryFilters><div className="directory-toolbar"><div className="sort-control"/></div><output>{value}</output></main>;}
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(async()=>root.render(<Page/>));await act(async()=>host.querySelector<HTMLButtonElement>('.mobile-toolbar-filters')!.click());const dialog=host.querySelector('dialog')!;expect(dialog.open).toBe(true);expect(dialog.querySelector('details')!.open).toBe(false);await act(async()=>dialog.querySelector<HTMLInputElement>('input[aria-label="Bellway"]')!.click());expect(host.querySelector('output')!.textContent).toBe('Bellway');await act(async()=>dialog.querySelector<HTMLButtonElement>('[aria-label="Close filters"]')!.click());expect(dialog.open).toBe(false);expect(host.querySelector('output')!.textContent).toBe('Bellway');}finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
