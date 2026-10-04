// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {builderFacts} from '../src/web/builder-facts';
import {DeveloperDirectory,type DeveloperCard} from '../src/web/directory';
vi.mock('../src/auth/browser',()=>({authClient:async()=>{throw new Error('Guest');}}));
it.each(['compact','list'] as const)('shows sourced ratings, scoped incentives and honest unknowns in %s view',async(view)=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);localStorage.clear();
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const cards:DeveloperCard[]=['barratt','ajc-homes'].map(slug=>({slug,name:slug,spaces:1,image:'/image.jpg',description:'',locations:[],...builderFacts(slug)}));
 try{
  await act(async()=>root.render(<DeveloperDirectory cards={cards} defaultView={view}/>));
  const facts=[host.querySelector('[href="/developers/barratt"] .builder-card-facts'),host.querySelector('[href="/developers/ajc-homes"] .builder-card-facts')];
  expect(facts[0]?.textContent).toContain('5 stars');expect(facts[0]?.textContent).toContain('2026 · Group');expect(facts[0]?.textContent).toContain('Selected homes');
  expect(facts[1]?.textContent).toContain('Not available');expect(facts[1]?.textContent).toContain('Not verified');
 }finally{await act(async()=>root.unmount());host.remove();localStorage.clear();vi.unstubAllGlobals();}
});
