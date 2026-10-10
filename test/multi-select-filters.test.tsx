// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {DeveloperDirectory,type DeveloperCard} from '../src/web/directory';
import {DirectoryFilters} from '../src/web/directory-filters';
import {MultiSelectFilter} from '../src/web/multi-select-filter';
import {selectionValue,selectedValues} from '../src/web/filter-selection';
import {filterSites,type SiteCard,type SiteFilters} from '../src/web/site-filters';
import {filterBuilders} from '../src/web/builder-filters';
vi.mock('../src/auth/browser',()=>({authClient:async()=>{throw new Error('Guest');}}));
afterEach(()=>{localStorage.clear();sessionStorage.clear();window.history.replaceState(null,'','/');vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('preserves multiple values including labels with commas and legacy single-value URLs',()=>{
 expect(selectedValues(selectionValue(['North, East','Scotland']))).toEqual(['North, East','Scotland']);expect(selectedValues('Scotland')).toEqual(['Scotland']);
});
it('uses OR within a filter and AND across filters on the same advertised property',()=>{
 const card:SiteCard={key:'a',name:'A',developer:'Alpha',country:'England',region:'North East',count:1,image:'a.jpg',description:'A',properties:[{price:300000,bedrooms:3,style:'Semi-detached'},{price:800000,bedrooms:5,style:'Detached'}]};
 const filters:SiteFilters={developer:selectionValue(['Alpha','Beta']),country:'',region:'North East',location:'',minPrice:'',maxPrice:'400000',minBeds:'5',maxBeds:'',style:selectionValue(['Detached','Semi-detached']),radius:''};
 expect(filterSites([card],filters,null)).toHaveLength(0);expect(filterSites([card],{...filters,minBeds:'3'},null)).toHaveLength(1);
});
it('requires region, chosen location and distance to match the same builder development',()=>{
 const card:DeveloperCard={slug:'alpha',name:'Alpha',spaces:2,image:'a.jpg',description:'A',locations:[{name:'Near',key:'near',region:'South',latitude:51,longitude:0},{name:'Far',key:'far',region:'North',latitude:56,longitude:0}]};
 expect(filterBuilders([card],{region:'North',location:'',radius:'5'},{latitude:51,longitude:0})).toHaveLength(0);
 expect(filterBuilders([card],{region:selectionValue(['North','South']),location:'near',radius:'5'},{latitude:51,longitude:0})).toHaveLength(1);
});
it('searches option lists only when there are more than six options',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const change=vi.fn();
 try{
  await act(async()=>root.render(<MultiSelectFilter label="Regions" value="" options={['A','B','C','D','E','F']} onChange={change}/>));expect(host.querySelector('input[type=search]')).toBeNull();
  await act(async()=>root.render(<MultiSelectFilter label="Regions" value="" options={['A','B','C','D','E','F','Scotland']} onChange={change}/>));
  const search=host.querySelector<HTMLInputElement>('input[type=search]')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(search,'scot');search.dispatchEvent(new Event('input',{bubbles:true}));});
  expect(host.querySelectorAll('input[type=checkbox]')).toHaveLength(1);await act(async()=>host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());expect(change).toHaveBeenCalledWith('Scotland');
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('filters builders by multiple development regions',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const cards:DeveloperCard[]=[{slug:'alpha',name:'Alpha',spaces:1,image:'a.jpg',description:'A',locations:[{name:'Leeds',key:'leeds',region:'Yorkshire',latitude:53.8,longitude:-1.5}]},{slug:'beta',name:'Beta',spaces:1,image:'b.jpg',description:'B',locations:[{name:'Edinburgh',key:'edinburgh',region:'Scotland',latitude:55.9,longitude:-3.2}]}];
 const filter=(name:string)=>[...host.querySelectorAll('.multi-filter')].find(node=>node.querySelector(':scope>span')?.textContent===name)!;
 try{
  await act(async()=>root.render(<DeveloperDirectory cards={cards}/>));
  const choose=async(value:string)=>{const label=[...filter('Development Locations').querySelectorAll('label')].find(node=>node.querySelector('span')?.textContent===value)!;await act(async()=>label.querySelector<HTMLInputElement>('input')!.click());};
  await choose('Scotland');expect(host.querySelectorAll('.collection-card')).toHaveLength(1);expect(host.querySelector('.collection-card')?.textContent).toContain('Beta');
  await choose('Yorkshire');expect(host.querySelectorAll('.collection-card')).toHaveLength(2);expect(filter('Development Locations').querySelectorAll('input:checked')).toHaveLength(2);expect(filter('Development Locations').querySelector('.multi-filter-selection')?.textContent).toBe('Multiple');expect(window.location.search).toBe('');
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('shows Multiple without pills and removes individual options using checkboxes',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const change=vi.fn();
 try{
  await act(async()=>root.render(<MultiSelectFilter label="Regions" value={selectionValue(['Scotland','Wales'])} options={['Scotland','Wales']} onChange={change}/>));
  expect(host.querySelector('.multi-filter-selection')?.textContent).toBe('Multiple');
  expect(host.querySelector('.multi-filter-chips')).toBeNull();
  await act(async()=>host.querySelector<HTMLInputElement>('[aria-label="Scotland"]')!.click());
  expect(change).toHaveBeenCalledWith('Wales');
  await act(async()=>root.render(<MultiSelectFilter label="Regions" value="Wales" options={['Scotland','Wales']} onChange={change}/>));
  await act(async()=>host.querySelector<HTMLInputElement>('[aria-label="Wales"]')!.click());
  expect(change).toHaveBeenLastCalledWith('');
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('disables cascading choices and replaces their chevron while calculating',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const {FilterPendingContext}=await import('../src/web/directory-filters');
 const host=document.createElement('div'),root=createRoot(host),change=vi.fn();
 const render=(pending:boolean)=>root.render(<FilterPendingContext.Provider value={pending}><MultiSelectFilter label="Builders" value="A" options={['A','B']} onChange={change}/></FilterPendingContext.Provider>);
 try{
  await act(async()=>render(true));expect(host.querySelector('.filter-chevron')).toBeNull();expect(host.querySelector('.results-update-spinner')).not.toBeNull();expect(host.querySelector('summary')?.getAttribute('aria-disabled')).toBe('true');
  await act(async()=>host.querySelector<HTMLInputElement>('input')!.click());expect(change).not.toHaveBeenCalled();
  await act(async()=>render(false));expect(host.querySelector('.filter-chevron')).not.toBeNull();expect(host.querySelector('.results-update-spinner')).toBeNull();expect(host.querySelector<HTMLInputElement>('input')!.disabled).toBe(false);
 }finally{await act(async()=>root.unmount());}
});

it('keeps independent filters interactive and menus open while results load',async()=>{
 vi.stubEnv('NEXT_PUBLIC_CASCADING_FILTERS','false');vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),change=vi.fn();
 const render=(pending:boolean)=><DirectoryFilters pending={pending}><MultiSelectFilter label="Colours" value="" options={['Blue','Green']} onChange={change}/></DirectoryFilters>;
 try{
  await act(async()=>root.render(render(false)));
  const menu=host.querySelector('details')!;menu.open=true;
  await act(async()=>root.render(render(true)));
  expect(menu.open).toBe(true);
  expect(host.querySelector('.results-update-spinner')).toBeNull();
  expect(host.querySelector('.directory-filter-row')?.getAttribute('aria-busy')).toBe('true');
  const inputs=host.querySelectorAll<HTMLInputElement>('input[type=checkbox]');
  expect(inputs[0]!.disabled).toBe(false);
  await act(async()=>inputs[0]!.click());await act(async()=>inputs[1]!.click());
  expect(change).toHaveBeenCalledTimes(2);expect(menu.open).toBe(true);
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('defers large filter menus until opened and preserves their choices',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const host=document.createElement('div');document.body.append(host);const root=createRoot(host),change=vi.fn();
 try{
  await act(async()=>root.render(<MultiSelectFilter label="Building Types" value="" options={Array.from({length:1000},(_,i)=>`Home ${i}`)} onChange={change}/>));
  expect(host.querySelectorAll('input')).toHaveLength(0);
  await act(async()=>{const details=host.querySelector('details')!;details.open=true;details.dispatchEvent(new Event('toggle'));});
  expect(host.querySelectorAll('input[type=checkbox]')).toHaveLength(1000);
  await act(async()=>host.querySelector<HTMLInputElement>('[aria-label="Home 777"]')!.click());expect(change).toHaveBeenCalledWith('Home 777');
  await act(async()=>{const details=host.querySelector('details')!;details.open=false;details.dispatchEvent(new Event('toggle'));});
  expect(host.querySelectorAll('input')).toHaveLength(0);
 }finally{await act(async()=>root.unmount());host.remove();}
});
