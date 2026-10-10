import {readFile,writeFile,mkdir,open,unlink} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {requireLocalContentRoot} from './local-ai-config';
import {atomicFile} from '../crawler/atomic-file';
const slugs=['persimmon','redrow','bloor-homes','keepmoat','larkfleet-homes'];
async function main(){
 const {values}=parseArgs({options:{sample:{type:'boolean'},outstanding:{type:'boolean'}}});
 const root=resolve('.showhome/processing/recovery');await mkdir(root,{recursive:true});
 const lockFile=resolve(root,'lock'),pid=await readFile(lockFile,'utf8').then(Number).catch(()=>0);
 if(pid){try{process.kill(pid,0);throw new Error('Recovery already active.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ESRCH')throw error;await unlink(lockFile);}}
 const lock=await open(lockFile,'wx');await lock.writeFile(String(process.pid));
 const contentRoot=await requireLocalContentRoot();process.env.SHOWHOME_LOCAL_ONLY='1';
 const state:{pid:number;status:string;current?:string;updatedAt?:string;builders:Record<string,unknown>}={pid:process.pid,status:'running',builders:{}};
 const save=()=>{state.updatedAt=new Date().toISOString();return atomicFile(resolve(root,values.sample?'sample-state.json':'state.json'),JSON.stringify(state,null,2));};
 let selected=slugs;
 if(values.outstanding){
  selected=[];
  const order=[...new Set((await readFile('docs/builder-recrawl-order.txt','utf8')).split(/\r?\n/).filter(Boolean))];
  for(const slug of order){
   const report=await readFile(`results/${slug}-home-offices/checkpoint.json`,'utf8').then(JSON.parse).catch(()=>undefined);
   if(!report||report.status==='failed'||report.status==='cancelled'||report.errors.some((e:{stage:string})=>['source','development','gallery','image'].includes(e.stage))||Object.values(report.crawlProgress?.galleries??{}).some(status=>status!=='completed')||report.metrics?.propertyLimitOmissions||report.metrics?.imageLimitOmissions||report.metrics?.developmentLimitOmissions)selected.push(slug);
  }
 }
 try{for(const slug of selected){
  state.current=slug;await save();
  const original=await readFile(`results/${slug}-home-offices/checkpoint.json`,'utf8').then(JSON.parse).catch(()=>undefined);
  const folder=values.sample?`results/recovery-samples/${slug}`:`results/${slug}-home-offices`;
  const args=['--import','tsx','src/cli/crawl.ts','--builder',slug,'--all-images','--discover-only','--content-root',contentRoot,'--output',folder,'--max-developments',values.sample?'1':'1000','--max-properties',values.sample?'1':'10000','--max-images',values.sample?'3':'100000'];
  if(['bloor-homes','keepmoat'].includes(slug)){args.push('--browser-snapshots','--development-list',resolve(root,slug+'-developments.json'));}
  if(values.sample){const url=original.properties[0]?.developmentUrl??original.developments[0]?.url;const list=resolve(root,slug+'-sample.json');await writeFile(list,JSON.stringify([url]));const index=args.indexOf('--development-list');if(index>=0)args[index+1]=list;else args.push('--development-list',list);}
  else if(original)args.push('--resume',...(['bloor-homes','keepmoat'].includes(slug)?[]:['--refresh-pages']));else args.push('--preserve-existing');
  const log=await open(resolve(root,`${values.sample?'sample':'crawl'}-${slug}.log`),'a');
  console.log(`Recovery ${values.sample?'sample':'crawl'}: ${slug}`);
  const child=spawn(process.execPath,args,{cwd:process.cwd(),windowsHide:true,stdio:['ignore',log.fd,log.fd]});
  const code=await new Promise<number>((accept,reject)=>{child.once('error',reject);child.once('close',code=>accept(code??1));});await log.close();
  const report=await readFile(resolve(folder,'results.json'),'utf8').then(JSON.parse).catch(()=>undefined);
  state.builders[slug]={exitCode:code,status:report?.status,crawlStatus:report?.crawlProgress?.status,images:report?.images?.length,metrics:report?.metrics,errors:report?.errors?.length,outstandingErrors:report?.errors?.filter((e:{stage:string})=>['source','development','gallery','image'].includes(e.stage)).length};
  await save();
  if(values.sample&&(code||!report?.images?.length))throw new Error(`Sample failed for ${slug}; inspect recovery log.`);
 }
 state.status='completed';delete state.current;await save();}finally{await lock.close();await unlink(lockFile);}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Recovery failed.');process.exitCode=1;});
