// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {useDirectoryQuery} from '../src/web/use-directory-query';
import {CardResults} from '../src/web/card-results';
it('appends database batches without duplicates and rejects stale filter responses',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.useFakeTimers();
 const seed={cards:[{key:'a'}],total:4,nextOffset:1,hasMore:true,facets:{},counts:{Styles:4}};
 const requests:{body:any;signal:AbortSignal;resolve:(value:Response)=>void}[]=[];
 vi.stubGlobal('fetch',vi.fn((_url,options)=>new Promise<Response>(resolve=>requests.push({body:JSON.parse(options.body),signal:options.signal,resolve}))));
 let query:ReturnType<typeof useDirectoryQuery<{key:string}>>;
 function Harness({developer=''}:{developer?:string}){query=useDirectoryQuery('buildings',{developer},null,seed);return <div>{query?.cards.map(c=>c.key).join(',')}</div>;}
 const mount=document.createElement('div');const root=createRoot(mount);
 const reply=(i:number,cards:{key:string}[])=>requests[i]!.resolve(Response.json({...seed,cards,nextOffset:3}));
 try{
  await act(async()=>root.render(<Harness/>));expect(requests).toHaveLength(0);
  await act(async()=>query!.loadMore(16));expect(requests[0]!.body.offset).toBe(1);
  await act(async()=>reply(0,[{key:'a'},{key:'b'}]));expect(mount.textContent).toBe('a,b');
  await act(async()=>root.render(<Harness developer="Bellway"/>));await act(async()=>vi.advanceTimersByTime(100));
  await act(async()=>root.render(<Harness developer="Cala"/>));expect(requests[1]!.signal.aborted).toBe(true);await act(async()=>vi.advanceTimersByTime(100));
  await act(async()=>reply(2,[{key:'c'}]));await act(async()=>reply(1,[{key:'stale'}]));expect(mount.textContent).toBe('c');expect(requests[2]!.body.filters.developer).toBe('Cala');
 }finally{await act(async()=>root.unmount());vi.useRealTimers();vi.unstubAllGlobals();}
});
it('requests another four rows and preserves existing card elements',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.spyOn(window,'getComputedStyle').mockReturnValue({gridTemplateColumns:'200px 200px 200px 200px'} as CSSStyleDeclaration);
 const load=vi.fn(),mount=document.createElement('div'),root=createRoot(mount);
 const render=(count:number,loading=false)=>root.render(<CardResults className="collection-grid" label="Buildings" identity="all" hasMore loading={loading} onLoadMore={load}>{Array.from({length:count},(_,i)=><article key={i}>{i}</article>)}</CardResults>);
 try{
  await act(async()=>render(16));const first=mount.querySelector('article');
  await act(async()=>mount.querySelector<HTMLButtonElement>('button')!.click());expect(load).toHaveBeenCalledWith(16);
  await act(async()=>render(16,true));expect(mount.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
  await act(async()=>render(32));expect(mount.querySelectorAll('article')).toHaveLength(32);expect(mount.querySelector('article')).toBe(first);
 }finally{await act(async()=>root.unmount());vi.restoreAllMocks();vi.unstubAllGlobals();}
});
