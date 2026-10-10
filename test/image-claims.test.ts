import {it,expect} from 'vitest';
import {claimImage} from '../src/vision/image-claims';
it('excludes simultaneous submissions and releases claims for retry',async()=>{
 const id='claim-test-'+process.pid;
 const first=await claimImage(id);expect(first).toBeTypeOf('function');
 try{expect(await claimImage(id)).toBeUndefined();}finally{await first!();}
 const retry=await claimImage(id);expect(retry).toBeTypeOf('function');await retry!();
});
