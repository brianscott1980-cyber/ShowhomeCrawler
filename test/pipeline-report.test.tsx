// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
vi.mock('../src/auth/browser',()=>({authClient:async()=>({auth:{getSession:async()=>({data:{session:{access_token:'owner'}}})}})}));
import {Classifications} from '../src/web/classifications';
it('shows separate current builders and a development summary without image cards',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const summary=(phase:string,builder:string,name:string,current:string)=>({phase,builder,builderName:name,source:'live',status:'running',updatedAt:new Date().toISOString(),currentDevelopments:[current],totals:{completed:2,total:4,failed:0,pending:2,images:4,developments:1,developmentsCompleted:0,structuredImages:0},models:[],developments:[{url:current,name:current,status:'running',completed:2,total:4,images:4,failed:0,pending:2}]});
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({commit:'abc123',liveAvailable:true,summaries:[summary('crawl','alpha','Alpha','First'),summary('classification','beta','Beta','Second')]})));
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>{root.render(<Classifications/>);});
  expect([...host.querySelectorAll('h3')].map(h=>h.textContent)).toEqual(expect.arrayContaining(['Alpha','Beta']));
  expect(host.textContent).toContain('Image crawling');expect(host.textContent).toContain('Image classifications');
  expect(host.querySelectorAll('img')).toHaveLength(0);
  await act(async()=>[...host.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Alpha')!.click());
  expect(host.querySelectorAll('table')).toHaveLength(2);
  expect(host.textContent).toContain('Development progress');
 }finally{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();}
});
