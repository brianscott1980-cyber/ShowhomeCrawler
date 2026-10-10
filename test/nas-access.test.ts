import {it,expect} from 'vitest';
import {writeFile,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {nasAccess,cacheImage,cachedImage,nasImage} from '../src/storage/nas-access';
import {sha256} from '../src/galleries/image-hasher';
it('serialises NAS operations and releases the queue after failure',async()=>{
 let active=0,peak=0;
 await Promise.all([1,2,3].map(()=>nasAccess(async()=>{active++;peak=Math.max(peak,active);await sleep(30);active--;})));
 expect(peak).toBe(1);
 await expect(nasAccess(async()=>{throw new Error('offline');})).rejects.toThrow('offline');
 expect(await nasAccess(async()=>42)).toBe(42);
});
it('reads verified SSD bytes without accessing NAS and rejects corrupt cache',async()=>{
 const bytes=Buffer.from(randomUUID()),id=sha256(bytes),path=resolve('.showhome/ssd-cache',id+'.bin');
 try{
  await cacheImage(id,bytes);expect(await nasImage(id,'missing-nas-file')).toEqual(bytes);
  await writeFile(path,'corrupt');await expect(cachedImage(id)).rejects.toThrow('hash mismatch');
  await expect(cacheImage(id,Buffer.from('wrong'))).rejects.toThrow('identifier');
 }finally{await unlink(path).catch(()=>{});}
});
