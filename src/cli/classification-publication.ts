import {classificationSnapshot} from '../reports/classification-snapshot';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile,readFile,rename,copyFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {randomUUID} from 'node:crypto';
import {writeReport,type RunReport} from '../reports/report';
import {createDatabase} from '../database/postgres';
import {importBuilder} from '../catalogue/import';
import {publishWebsite} from '../catalogue/publish';
const exec=promisify(execFile);
const git=async(...args:string[])=>(await exec('git',args,{maxBuffer:8*1024*1024})).stdout.trim();
const checkpoint=resolve('.showhome/classification-publication.json');
async function atomic(file:string,value:unknown){await mkdir(resolve(file,'..'),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(value,null,2));await rename(temp,file);}
interface State {phase:'publication'|'commit'|'push'|'done';slug:string;sourceFolder:string;development:string;branch:string;commit?:string}
export async function preparePublication(){
 const branch=await git('branch','--show-current');
 if(!branch)throw new Error('Classification publication requires a named branch.');
 await git('rev-parse','--abbrev-ref','--symbolic-full-name','@{upstream}');
 // Retry unfinished database publication/commit/push before classifying more images.
 const state:State|null=await readFile(checkpoint,'utf8').then(JSON.parse).catch(error=>{if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;});
 if(state&&state.phase!=='done'){if(state.branch!==branch)throw new Error('Resume publication on branch '+state.branch);await finish(state);}
 if(await git('status','--porcelain'))throw new Error('Commit or resolve working tree changes before a publishing classification run.');
 return branch;
}
export async function developmentPublication(slug:string,sourceFolder:string,development:string,report:RunReport,branch:string){
 await writeReport(sourceFolder,report);
 const canonical=resolve('collections',slug+'-home-offices');await mkdir(canonical,{recursive:true});
 if(resolve(sourceFolder)!==canonical)for(const file of ['results.json','full-report.html','index.html','properties.csv','matches.csv'])await copyFile(resolve(sourceFolder,file),resolve(canonical,file));
 const state:State={phase:'publication',slug,sourceFolder:canonical,development,branch};
 await atomic(checkpoint,state);await finish(state);
}
async function finish(state:State){
 const report=JSON.parse(await readFile(resolve(state.sourceFolder,'results.json'),'utf8')) as RunReport;
 if(state.phase==='publication'){
  const sql=createDatabase();try{await importBuilder(sql,state.slug);await publishWebsite(sql);}finally{await sql.end();}
  await atomic(resolve('classification-reports',state.slug+'.json'),classificationSnapshot(state.slug,report,state.development,'published'));
  state.phase='commit';await atomic(checkpoint,state);
 }
 if(state.phase==='commit'){
  const paths=['results.json','full-report.html','index.html','properties.csv','matches.csv'].map(f=>relative(process.cwd(),resolve(state.sourceFolder,f)));
  paths.push('classification-reports/'+state.slug+'.json');
  const staged=(await git('diff','--cached','--name-only')).split('\n').filter(Boolean);
  const allowed=new Set(paths.map(p=>p.replaceAll('\\','/')));
  if(staged.some(p=>!allowed.has(p)))throw new Error('Unrelated staged changes prevent an isolated classification commit.');
  await git('add','--',...paths);await git('diff','--cached','--check');
  if(await git('diff','--cached','--name-only'))await git('commit','-m',`Classify ${state.slug} — ${state.development}`);
  state.commit=await git('rev-parse','HEAD');state.phase='push';await atomic(checkpoint,state);
 }
 if(state.phase==='push'){
  await git('push');state.phase='done';await atomic(checkpoint,state);
  console.log(`Published and pushed ${state.slug}: ${state.development} (${state.commit})`);
 }
}
