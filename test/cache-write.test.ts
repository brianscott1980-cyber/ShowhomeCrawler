import {expect,it,vi} from 'vitest';
import {cacheWrite} from '../src/database/cache-write';
it('serves an uncached result when storage rejects a cache write',async()=>{
 const warning=vi.spyOn(console,'warn').mockImplementation(()=>{});
 try{await expect(cacheWrite(async()=>{throw {code:'25006'};})).resolves.toBeUndefined();await expect(cacheWrite(async()=>{throw {code:'53100'};})).resolves.toBeUndefined();}
 finally{warning.mockRestore();}
});
it('surfaces unrelated database errors',async()=>{
 const error={code:'42P01'};await expect(cacheWrite(async()=>{throw error;})).rejects.toBe(error);
});
