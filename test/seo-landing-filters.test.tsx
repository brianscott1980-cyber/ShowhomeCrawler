// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {FixedPageFilters} from '../src/web/fixed-page-filters';
import {MultiSelectFilter} from '../src/web/multi-select-filter';
import {useUrlFilters} from '../src/web/url-filters';
import {colourLabels,colourRoomTitle} from '../src/web/seo-landing-values';
vi.mock('next/navigation',()=>({usePathname:()=>'/developments/avant'}));
const defaults={developer:'',site:''};
function Preview(){const [filters,setFilters]=useUrlFilters(defaults);return <><output>{JSON.stringify(filters)}</output><MultiSelectFilter label="Builders" value={filters.developer} options={['Avant','Bellway']} onChange={developer=>setFilters({...filters,developer})}/><MultiSelectFilter label="Developments" value={filters.site} options={['Example']} onChange={site=>setFilters({...filters,site})}/><button onClick={()=>setFilters(defaults)}>Reset</button></>;}
it('hides the fixed filter and retains its value through incoming criteria and reset',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 window.history.replaceState(null,'','/developments/avant?developer=Bellway&site=Example');
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<FixedPageFilters filters={{developer:'Avant'}}><Preview/></FixedPageFilters>));
  expect(host.querySelector('output')?.textContent).toBe('{"developer":"Avant","site":"Example"}');
  expect(host.textContent).not.toContain('Builders');expect(host.textContent).toContain('Developments');
  await act(async()=>host.querySelector<HTMLButtonElement>('button:last-child')!.click());
  expect(host.querySelector('output')?.textContent).toBe('{"developer":"Avant","site":""}');
 }finally{await act(async()=>root.unmount());host.remove();sessionStorage.clear();window.history.replaceState(null,'','/');vi.unstubAllGlobals();}
});
it('matches colour words without partial-word false positives and formats room titles',()=>{
 expect(colourLabels('blue',['Blue','Blue Decor','Blue Wallpaper','Blueberry','Red'])).toEqual(['Blue','Blue Decor','Blue Wallpaper']);
 expect(colourLabels('grey',['Gray Curtains','Grey'])).toEqual(['Gray Curtains','Grey']);
 expect(colourRoomTitle('blue','Bedroom')).toBe('Blue Bedrooms');
 expect(colourRoomTitle('red','Bathroom')).toBe('Red Bathrooms');
});
