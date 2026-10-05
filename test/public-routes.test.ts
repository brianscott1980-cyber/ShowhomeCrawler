import {expect,it,vi} from 'vitest';
vi.mock('next/navigation',()=>({permanentRedirect:(url:string)=>{throw new Error(`redirect:${url}`);},notFound:()=>{throw new Error('not found');}}));
import Page,{generateMetadata} from '../src/app/[[...path]]/page';
it('serves builders and developments directories at their new URLs',async()=>{
 for(const path of ['builders','developments']){
  expect(await Page({params:Promise.resolve({path:[path]}),searchParams:Promise.resolve({})})).toBeTruthy();
  expect((await generateMetadata({params:Promise.resolve({path:[path]}),searchParams:Promise.resolve({})})).alternates?.canonical).toBe(`/${path}`);
 }
 expect(await Page({params:Promise.resolve({path:['builders','tulloch-homes']}),searchParams:Promise.resolve({})})).toBeTruthy();
});
it('redirects old directories and detail URLs while preserving existing deep links',async()=>{
 for(const [old,next] of [['homebuilders','builders'],['developers/tulloch-homes','builders/tulloch-homes'],['locations/builder/site','developments/builder/site']]){
  await expect(Page({params:Promise.resolve({path:old!.split('/')}),searchParams:Promise.resolve({radius:'25'})})).rejects.toThrow(`redirect:/${next}?radius=25`);
 }
});
