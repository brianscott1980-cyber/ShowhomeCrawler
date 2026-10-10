import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
it('consolidates images and imports classifications without replacing current work',async()=>{
 const root=await mkdtemp(join(tmpdir(),'showhome-import-'));
 const bytes=Buffer.from('fixture original image'),id=createHash('sha256').update(bytes).digest('hex');
 const write=async(p:string,value:string|Buffer)=>{const target=join(root,p);await mkdir(join(target,'..'),{recursive:true});await writeFile(target,value);};
 try{
  await write(`backups/nas-import/assets/${id}.jpg`,bytes);
  const image={id,path:`images/${id}.jpg`,categorisation:{mainCategory:'Bathroom'}};
  const report={builder:{slug:'example'},images:[image],properties:[{url:'home',imageIds:[id]}],developments:[],status:'completed'};
  await write('backups/nas-import/archive/results/example-home-offices/results.json',JSON.stringify(report));
  const existing={image:{...image,categorisation:{mainCategory:'Kitchen'}}};
  await write(`.showhome/supabase-outbox/example/${id}.json`,JSON.stringify(existing));
  await promisify(execFile)(process.execPath,[resolve('scripts/consolidate-local-content.mjs')],{env:{...process.env,LOCAL_CONTENT_ROOT:root}});
  expect(await readFile(join(root,`assets/${id}.jpg`))).toEqual(bytes);
  expect(JSON.parse(await readFile(join(root,`.showhome/supabase-outbox/example/${id}.json`),'utf8'))).toEqual(existing);
  expect(JSON.parse(await readFile(join(root,'.showhome/imported-reports/example/results.json'),'utf8')).images[0].id).toBe(id);
  const progress=JSON.parse(await readFile(join(root,'.showhome/storage-migration/progress.json'),'utf8'));
  expect(progress.status).toBe('completed');expect(progress.conflicts).toBe(1);expect(progress.newAssets).toBe(1);
  expect(await readFile(join(root,`backups/nas-import/assets/${id}.jpg`))).toEqual(bytes);
 }finally{if(!resolve(root).startsWith(resolve(tmpdir())+'\\')&&!resolve(root).startsWith(resolve(tmpdir())+'/'))throw new Error('Unexpected fixture cleanup path');await rm(root,{recursive:true,force:true});}
});
