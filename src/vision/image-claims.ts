import {mkdir,open,readFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
/** Cross-process claims prevent Ollama and Gemini submitting the same image. */
export async function claimImage(id:string){
 const folder=resolve('.showhome/processing/image-claims');await mkdir(folder,{recursive:true});const file=resolve(folder,id+'.json');
 try{const lock=await open(file,'wx');await lock.writeFile(JSON.stringify({pid:process.pid}));await lock.close();return async()=>{await unlink(file).catch(()=>{});};}
 catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
  try{const old=JSON.parse(await readFile(file,'utf8'));try{process.kill(old.pid,0);return undefined;}catch{await unlink(file);return claimImage(id);}}catch{return undefined;}
 }
}
