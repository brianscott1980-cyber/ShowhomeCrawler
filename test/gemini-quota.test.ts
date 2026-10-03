import {it,expect,vi} from 'vitest';
import sharp from 'sharp';
import {classifyBatch} from '../src/vision/gemini-classifier.js';
it('retries Gemini quota failures after two minutes and keeps credentials out of errors',async()=>{
 const image=await sharp({create:{width:2,height:2,channels:3,background:'white'}}).png().toBuffer();
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{details:[{retryDelay:'30s',violations:[{quotaId:'daily'}]}]}}),{status:429})));
 try{await expect(classifyBatch([{id:'photo',bytes:image}],'secret-key','test-model',true)).rejects.toMatchObject({message:'Gemini HTTP 429',status:429,retrySeconds:120});}finally{vi.unstubAllGlobals();}
});
