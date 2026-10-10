import {writeFile,rename,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
/** Readers and virus scanners can briefly hold Windows report files open. */
export async function atomicFile(path:string,body:string|Buffer){
 const temp=path+'.'+randomUUID()+'.tmp';await writeFile(temp,body);
 try{for(let attempt=0;;attempt++){try{await rename(temp,path);return;}catch(error){if(!['EPERM','EACCES','EBUSY'].includes((error as NodeJS.ErrnoException).code??'')||attempt>=9)throw error;await sleep(100*(attempt+1));}}}
 finally{await unlink(temp).catch(()=>{});}
}
