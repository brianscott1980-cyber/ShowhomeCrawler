import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({files:new Map<string,Buffer|string>()}));
vi.mock('node:fs/promises',()=>({readFile:vi.fn(async(path:string,encoding?:string)=>{const value=mocks.files.get(String(path));if(value===undefined)throw Object.assign(new Error('missing'),{code:'ENOENT'});return encoding?String(value):Buffer.from(value)}),stat:vi.fn(async()=>({mtimeMs:Math.random()}))}));
import {storedFile,storedImage} from '../src/web/content-storage';
import {resolve} from 'node:path';
const id='a'.repeat(64);
beforeEach(()=>{mocks.files.clear();});
it('serves a verified NAS original',async()=>{
 mocks.files.set('.showhome/storage-status.json',JSON.stringify({nasAvailable:true,checkedAt:Date.now()/1000,contentRoot:'/nas'}));
 mocks.files.set('.showhome/storage-config.json',JSON.stringify({identity:'expected'}));
 mocks.files.set('/nas/.showhome-storage.json',JSON.stringify({id:'expected'}));
 mocks.files.set(`/nas/assets/${id}.jpg`,'original');
 expect((await storedImage(id,'jpg')).bytes.toString()).toBe('original');
});
it('uses offline previews for the website but never for AI workers',async()=>{
 const preview=Buffer.from('RIFF0000WEBPpreview');mocks.files.set(resolve(`.showhome/previews/${id}.webp`),preview);
 expect((await storedImage(id,'jpg')).extension).toBe('webp');
 await expect(storedFile(`results/builder/images/${id}.jpg`)).rejects.toThrow('Content unavailable');
});
it('remembers an existing NAS download while disconnected instead of redownloading',async()=>{
 mocks.files.set(resolve('.showhome/raw-image-index.json'),JSON.stringify({[id]:`${id}.jpg`}));
 await expect(storedFile(`results/.cache/${id}.bin`)).rejects.toMatchObject({storedOnNas:true});
});
it('rejects a different NAS storage identity',async()=>{
 mocks.files.set('.showhome/storage-status.json',JSON.stringify({nasAvailable:true,checkedAt:Date.now()/1000,contentRoot:'/nas'}));
 mocks.files.set('.showhome/storage-config.json',JSON.stringify({identity:'expected'}));
 mocks.files.set('/nas/.showhome-storage.json',JSON.stringify({id:'wrong'}));
 mocks.files.set(`/nas/assets/${id}.jpg`,'wrong NAS');
 await expect(storedImage(id,'jpg')).rejects.toThrow('Content unavailable');
});
