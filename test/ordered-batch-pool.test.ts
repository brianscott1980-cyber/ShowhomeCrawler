import {expect,it} from 'vitest';
import {orderedBatchPool} from '../src/vision/ordered-batch-pool';
it('starts batches in order with three active requests and fills freed slots immediately',async()=>{
 const started:number[]=[],release=new Map<number,()=>void>();let active=0,max=0;
 const result=orderedBatchPool([0,1,2,3,4],3,async index=>{started.push(index);max=Math.max(max,++active);await new Promise<void>(resolve=>release.set(index,resolve));active--;});
 expect(started).toEqual([0,1,2]);release.get(1)!();await new Promise(resolve=>setTimeout(resolve,0));
 expect(started).toEqual([0,1,2,3]);release.get(0)!();await new Promise(resolve=>setTimeout(resolve,0));
 expect(started).toEqual([0,1,2,3,4]);for(const index of [2,3,4])release.get(index)!();await result;
 expect(max).toBe(3);
});
it('stops dispatch on failure and drains in-flight work before returning',async()=>{
 const started:number[]=[];let finish!:()=>void,settled=false;
 const result=orderedBatchPool([0,1,2],2,async index=>{started.push(index);if(index===0)throw new Error('failed');await new Promise<void>(resolve=>finish=resolve);});
 const observed=result.catch(error=>{settled=true;return error.message;});
 await new Promise(resolve=>setTimeout(resolve,0));expect(settled).toBe(false);expect(started).toEqual([0,1]);finish();expect(await observed).toBe('failed');
});
