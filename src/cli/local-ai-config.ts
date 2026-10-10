import {config} from 'dotenv';
import {nasAccess} from '../storage/nas-access';
import {access,readFile,writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve} from 'node:path';
import {createInterface} from 'node:readline/promises';
config({path:'.env.local',quiet:true});
config({quiet:true});
/** dotenv preserves Windows backslashes inside quotes; don't JSON-escape paths. */
export function envSetting(name:string,value:string){
 if(/[\r\n]/.test(value))throw new Error('Configuration values must be one line.');
 const quote=value.includes("'")?'"':"'";
 if(value.includes("'")&&value.includes('"'))throw new Error('Use a path without both kinds of quotation marks.');
 return `${name}=${quote}${value}${quote}`;
}
export async function saveLocalSetting(name:string,value:string){
 const file=resolve('.env.local'),previous=await readFile(file,'utf8').catch(error=>{if(error.code==='ENOENT')return '';throw error;});
 const line=envSetting(name,value),pattern=new RegExp('^'+name+'=.*$','m');
 await writeFile(file,pattern.test(previous)?previous.replace(pattern,()=>line):previous+(previous.endsWith('\n')||!previous?'':'\n')+line+'\n',{mode:0o600});
 process.env[name]=value;
}
export async function requireLocalContentRoot(explicit?:string){
 let root=explicit||process.env.LOCAL_CONTENT_ROOT;
 if(!root){
  if(!process.stdin.isTTY||!process.stdout.isTTY)throw new Error('Set LOCAL_CONTENT_ROOT in .env.local or pass --content-root before running. Interactive terminals prompt for it.');
  const terminal=createInterface({input:process.stdin,output:process.stdout});
  try{root=(await terminal.question('Content folder (e.g. D:\\ShowhomeCrawler): ')).trim().replace(/^(["'])(.*)\1$/,'$2');}finally{terminal.close();}
  if(!root)throw new Error('A content folder is required.');
 }
 try{if(root.startsWith('\\\\'))await nasAccess(()=>access(resolve(root,'assets'),constants.R_OK));else await access(resolve(root,'assets'),constants.R_OK);}catch{throw new Error('Content folder is unavailable or lacks an assets directory. Update LOCAL_CONTENT_ROOT in .env.local.');}
 if(!explicit&&root!==process.env.LOCAL_CONTENT_ROOT)await saveLocalSetting('LOCAL_CONTENT_ROOT',root);
 return root;
}
