import {beforeEach,expect,it,vi} from 'vitest';
const fs=vi.hoisted(()=>({writeFile:vi.fn(),rename:vi.fn(),unlink:vi.fn()}));
vi.mock('node:fs/promises',()=>fs);
vi.mock('node:timers/promises',()=>({setTimeout:vi.fn().mockResolvedValue(undefined)}));
import {atomicFile} from '../src/crawler/atomic-file';
beforeEach(()=>{vi.resetAllMocks();fs.writeFile.mockResolvedValue(undefined);fs.rename.mockResolvedValue(undefined);fs.unlink.mockResolvedValue(undefined);});
it('retries a temporary Windows lock without rewriting the target',async()=>{
 fs.rename.mockRejectedValueOnce(Object.assign(new Error('Locked'),{code:'EPERM'}));
 await atomicFile('report.json','saved progress');
 expect(fs.writeFile).toHaveBeenCalledTimes(1);
 expect(fs.rename).toHaveBeenCalledTimes(2);
 expect(fs.rename.mock.calls[0]).toEqual(fs.rename.mock.calls[1]);
 expect(fs.unlink).toHaveBeenCalledTimes(1);
});
it('surfaces persistent locks after bounded retries and removes the temporary file',async()=>{
 fs.rename.mockRejectedValue(Object.assign(new Error('Locked'),{code:'EPERM'}));
 await expect(atomicFile('report.json','saved progress')).rejects.toThrow('Locked');
 expect(fs.rename).toHaveBeenCalledTimes(10);
 expect(fs.unlink).toHaveBeenCalledTimes(1);
});
it('does not retry unrelated filesystem failures',async()=>{
 fs.rename.mockRejectedValue(Object.assign(new Error('Missing directory'),{code:'ENOENT'}));
 await expect(atomicFile('report.json','saved progress')).rejects.toThrow('Missing directory');
 expect(fs.rename).toHaveBeenCalledTimes(1);
});
