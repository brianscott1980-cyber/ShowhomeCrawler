import {requireLocalContentRoot} from './local-ai-config.js';
import {parseArgs} from 'node:util';
import {spawn} from 'node:child_process';
const {values}=parseArgs({options:{model:{type:'string',default:process.env.LOCAL_AI_MODEL??'qwen3-vl:2b-instruct'},host:{type:'string',default:process.env.OLLAMA_HOST??'http://127.0.0.1:11434'}}});
const host=values.host!.replace(/\/$/,'');
try{
 await requireLocalContentRoot();
 let available=await fetch(host+'/api/tags',{signal:AbortSignal.timeout(3000)}).then(response=>response.ok).catch(()=>false);
 if(!available){
  console.log('Starting Ollama. If it is not installed, install it from https://ollama.com/download and rerun this command.');
  let startError:Error|undefined;
  const server=spawn('ollama',['serve'],{detached:true,stdio:'ignore',env:{...process.env,OLLAMA_HOST:host}});server.on('error',error=>{startError=error;});server.unref();
  for(let attempt=0;attempt<20&&!available;attempt++){await new Promise(resolve=>setTimeout(resolve,500));if(startError)throw new Error('Ollama is not installed. Install https://ollama.com/download first.');available=await fetch(host+'/api/tags',{signal:AbortSignal.timeout(2000)}).then(response=>response.ok).catch(()=>false);}
  if(!available)throw new Error('Ollama is not responding. Start the Ollama app or run ollama serve.');
 }
 console.log(`Preparing ${values.model} on ${host}`);
 const response=await fetch(host+'/api/pull',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:values.model,stream:true})});
 if(!response.ok||!response.body)throw new Error(`Model download HTTP ${response.status}`);
 let buffer='',last=0;
 for await(const chunk of response.body){buffer+=new TextDecoder().decode(chunk);let newline;while((newline=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);if(!line.trim())continue;const status=JSON.parse(line);if(status.error)throw new Error(status.error);if(Date.now()-last>3000||status.status==='success'){last=Date.now();console.log(status.status+(status.total?` ${Math.round(100*status.completed/status.total)}%`:''));}}}
 console.log('Ready. Run npm run ai:local:sample');
}catch(error){console.error(error instanceof Error?error.message:'Local setup failed.');process.exitCode=1;}
