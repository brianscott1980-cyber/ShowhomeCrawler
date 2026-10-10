import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({files:new Map<string,Buffer|string>()}));
vi.mock('node:fs/promises',()=>({readFile:vi.fn(async(path:string,encoding?:string)=>{const value=mocks.files.get(String(path));if(value===undefined)throw Object.assign(new Error('missing'),{code:'ENOENT'});return encoding?String(value):Buffer.from(value)}),stat:vi.fn(async(path:string)=>{if(!mocks.files.has(String(path)))throw Object.assign(new Error('missing'),{code:'ENOENT'});return {mtimeMs:Math.random()}})}));
import {storedFile,storedImage} from '../src/web/content-storage';
vi.mock('../src/storage/nas-access',()=>({nasAccess:async(operation:()=>Promise<unknown>)=>operation(),nasImage:async(_id:string,path:string)=>{const {readFile}=await import('node:fs/promises');return readFile(path);}}));
import {resolve} from 'node:path';
const id='a'.repeat(64);
beforeEach(()=>{mocks.files.clear();});
it('serves a verified NAS original',async()=>{
 mocks.files.set('.showhome/storage-status.json',JSON.stringify({nasAvailable:true,checkedAt:Date.now()/1000,contentRoot:'/nas'}));
 mocks.files.set('.showhome/storage-config.json',JSON.stringify({identity:'expected'}));
 mocks.files.set(resolve('/nas/.showhome-storage.json'),JSON.stringify({id:'expected'}));
 mocks.files.set(resolve(`/nas/assets/${id}.jpg`),'original');
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
 mocks.files.set(resolve('/nas/.showhome-storage.json'),JSON.stringify({id:'wrong'}));
 mocks.files.set(resolve(`/nas/assets/${id}.jpg`),'wrong NAS');
 await expect(storedImage(id,'jpg')).rejects.toThrow('Content unavailable');
});
it('resolves legacy catalogue IDs to verified content hashes and their offline previews',async()=>{
 const actual='b'.repeat(64);const local=`results/old/images/${id}.jpg`;
 mocks.files.set(resolve('.showhome/image-index.json'),JSON.stringify({[local]:`${actual}.jpg`}));
 mocks.files.set(resolve(`.showhome/previews/${actual}.webp`),Buffer.from('RIFF0000WEBPlegacy'));
 expect((await storedImage(id,'jpg',local)).bytes.toString()).toContain('legacy');
});
