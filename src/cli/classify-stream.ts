import {hasSiteCategorisation} from '../vision/site-categorisation.js';
import {GeminiModelPool,classificationModels} from '../vision/gemini-model-pool.js';
import {saveGeminiState} from '../reports/gemini-status.js';
import { isInferredAnalysis } from '../vision/analysis-provenance.js';
import { access, readFile, writeFile, rename, open, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';
import { readEnv } from '../config/env.js';
import { sha256 } from '../galleries/image-hasher.js';
import { analysisVersion, classifyBatch, verdictSchema } from '../vision/gemini-classifier.js';
import type { RunReport } from '../reports/report.js';
async function main() {
 const { values } = parseArgs({ options: { 'reuse-model':{type:'string',multiple:true}, 'all-images':{type:'boolean'}, model:{type:'string'}, folder: { type: 'string' } } });
 const folder = values.folder; if (!folder?.startsWith('results/') || folder.includes('..')) throw new Error('Local result folder required.');
 const env = readEnv(); if (!env.GEMINI_API_KEY) throw new Error('Gemini key required.');
 let stopped = false;
 process.once('SIGTERM', () => { stopped = true; });
 process.once('SIGINT', () => { stopped = true; });
 const initial:RunReport=JSON.parse(await readFile(`${folder}/checkpoint.json`,'utf8'));
 const pool=new GeminiModelPool(classificationModels(values.model??initial.model));
 const classifyWithFallback=async(items:Parameters<typeof classifyBatch>[0])=>{
  const result=await pool.run(model=>classifyBatch(items,env.GEMINI_API_KEY!,model,values['all-images']),async()=>{const snapshot=pool.snapshot();const waiting=snapshot.modelStates.every(m=>m.status!=='ready');await saveGeminiState(folder,{state:waiting?'quota_wait':'analysing',model:pool.currentModel,...snapshot});});
  return result.value.map(answer=>({...answer,analysisModel:result.model}));
 };
 const lock = await open(`${folder}/.analysis-stream.lock`, 'wx');
 try {
  while (!stopped) {
   const report: RunReport = JSON.parse(await readFile(`${folder}/checkpoint.json`, 'utf8'));
   const model = values.model ?? report.model;
   const version = values['all-images'] ? 'all-property-images-v1' : analysisVersion;
   await saveGeminiState(folder,{state:'analysing',model:pool.currentModel,...pool.snapshot()});
   const running = await access(`${folder}/.lock`).then(() => true, () => false);
   const pending = [];
   for (const image of report.images) {
    if(values['all-images']&&hasSiteCategorisation(image))continue;
    if (!isInferredAnalysis(image.verdict) && (values['all-images'] ? image.categorisation : image.verdict)) continue;
    let cached = false;
    for (const cachedModel of [...new Set([...pool.models,report.model,...(values['reuse-model'] ?? [])])]) {
     const path = `results/.cache/analysis/${sha256(`${image.id}:${cachedModel}:${version}`)}.json`;
     try { const answer=JSON.parse(await readFile(path, 'utf8')); if(isInferredAnalysis(answer))continue; verdictSchema.parse(answer); cached = true; break; } catch {}
    }
    if (!cached) pending.push(image);
    if (pending.length === 24) break;
   }
   if (!pending.length || (running && pending.length < 8)) {
    if (!running && !pending.length) {await saveGeminiState(folder,{state:'complete',model:pool.currentModel,...pool.snapshot()});break;}
    await sleep(10000); continue;
   }
   const batch = await Promise.all(pending.map(async i => {
    if (!/^images\/[a-f0-9]{64}\.(jpg|jpeg|png|webp|avif|gif|tiff)$/.test(i.path)) throw new Error('Invalid image path.');
    return { id: i.id, bytes: await readFile(`${folder}/${i.path}`) };
   }));
   await Promise.all(Array.from({length: Math.ceil(batch.length / 8)}, (_, index) => batch.slice(index * 8, index * 8 + 8)).map(async group => {
   let answers;
   for (let attempt = 0; ; attempt++) {
    if(stopped)return;
    try { answers = await classifyWithFallback(group); break; }
    catch (error) {
     const failure = error as {status?: number;retrySeconds?: number;quotaViolations?: unknown};
     const status = failure.status;
     const isRateLimit = status === 429 || /rate|quota|exhausted|429/i.test(String(error));
     console.log(JSON.stringify({stage:'stream_retry',developer:report.builder?.name,status:status ?? 'invalid_response',quota:failure.quotaViolations,attempt:attempt+1}));
     if (isRateLimit) {
      console.log('All available Gemini models are quota limited. Pausing for 2 minutes before retrying...');
      const delaySeconds = 120;
      await saveGeminiState(folder,{state:'quota_wait',model:pool.currentModel,...pool.snapshot(),httpStatus:429,retryAt:new Date(Date.now()+delaySeconds*1000).toISOString()});
      for (let s = 0; s < delaySeconds && !stopped; s += 10) await sleep(Math.min(10, delaySeconds - s) * 1000);
      attempt--; // Quota waits do not consume transient-error retries.
continue;
     }
     if (attempt >= 3 && !status) {
      answers = [];
      for (const item of group) {
       answers.push(...await classifyWithFallback([item]));
       await sleep(4000);
      }
      break;
     }
     if (attempt >= 3 || (status && ![429,500,502,503,504].includes(status))) throw error;
     await saveGeminiState(folder,{state:'retrying',model:pool.currentModel,...pool.snapshot(),httpStatus:status});
     const delay = Math.min(120000, Math.max(10000 * 2 ** attempt, (failure.retrySeconds ?? 0) * 1000));
     for (let elapsed=0;elapsed<delay;elapsed+=10000) await sleep(Math.min(10000,delay-elapsed));
    }
   }
   for (const answer of answers) {
    const path = `results/.cache/analysis/${sha256(`${answer.id}:${answer.analysisModel}:${version}`)}.json`;
    const temp = path + '.' + randomUUID() + '.tmp'; await writeFile(temp, JSON.stringify({...answer.verdict,analysisModel:answer.analysisModel})); await rename(temp, path);
   }
   console.log(JSON.stringify({stage:'stream_batch_cached',developer:report.builder?.name,images:answers.length,matches:answers.filter(a=>a.verdict.matches).length,discoveredImages:report.images.length}));
   }));
   await sleep(12000);
  }
 } finally { await lock.close(); await unlink(`${folder}/.analysis-stream.lock`); }
}
main().catch(()=>{console.error('Streaming classification stopped; resume with results:classify.');process.exitCode=1;});
