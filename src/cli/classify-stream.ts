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
 const lock = await open(`${folder}/.analysis-stream.lock`, 'wx');
 try {
  while (!stopped) {
   const report: RunReport = JSON.parse(await readFile(`${folder}/checkpoint.json`, 'utf8'));
   const model = values.model ?? report.model;
   const version = values['all-images'] ? 'all-property-images-v1' : analysisVersion;
   const running = await access(`${folder}/.lock`).then(() => true, () => false);
   const pending = [];
   for (const image of report.images) {
    if (values['all-images'] ? image.categorisation : image.verdict) continue;
    let cached = false;
    for (const cachedModel of [...new Set([model, report.model, ...(values['reuse-model'] ?? [])])]) {
     const path = `results/.cache/analysis/${sha256(`${image.id}:${cachedModel}:${version}`)}.json`;
     try { verdictSchema.parse(JSON.parse(await readFile(path, 'utf8'))); cached = true; break; } catch {}
    }
    if (!cached) pending.push(image);
    if (pending.length === 24) break;
   }
   if (!pending.length || (running && pending.length < 8)) {
    if (!running && !pending.length) break;
    await sleep(10000); continue;
   }
   const batch = await Promise.all(pending.map(async i => {
    if (!/^images\/[a-f0-9]{64}\.(jpg|jpeg|png|webp|avif|gif|tiff)$/.test(i.path)) throw new Error('Invalid image path.');
    return { id: i.id, bytes: await readFile(`${folder}/${i.path}`) };
   }));
   await Promise.all(Array.from({length: Math.ceil(batch.length / 8)}, (_, index) => batch.slice(index * 8, index * 8 + 8)).map(async group => {
   let answers;
   for (let attempt = 0; ; attempt++) {
    try { answers = await classifyBatch(group, env.GEMINI_API_KEY!, model, values['all-images']); break; }
    catch (error) {
     const failure = error as {status?: number;retrySeconds?: number;quotaViolations?: unknown};
     const status = failure.status;
     console.log(JSON.stringify({stage:'stream_retry',developer:report.builder?.name,status:status ?? 'invalid_response',quota:failure.quotaViolations,attempt:attempt+1}));
     if ((failure.retrySeconds ?? 0) > 120) throw error;
     if (attempt >= 3 && !status) {
      answers = [];
      for (const item of group) {
       answers.push(...await classifyBatch([item], env.GEMINI_API_KEY!, model, values['all-images']));
       await sleep(4000);
      }
      break;
     }
     if (attempt >= 3 || (status && ![429,500,502,503,504].includes(status))) throw error;
     const delay = Math.min(120000, Math.max(10000 * 2 ** attempt, (failure.retrySeconds ?? 0) * 1000));
     for (let elapsed=0;elapsed<delay;elapsed+=10000) await sleep(Math.min(10000,delay-elapsed));
    }
   }
   for (const answer of answers) {
    const path = `results/.cache/analysis/${sha256(`${answer.id}:${model}:${version}`)}.json`;
    const temp = path + '.' + randomUUID() + '.tmp'; await writeFile(temp, JSON.stringify(answer.verdict)); await rename(temp, path);
   }
   console.log(JSON.stringify({stage:'stream_batch_cached',developer:report.builder?.name,images:answers.length,matches:answers.filter(a=>a.verdict.matches).length,discoveredImages:report.images.length}));
   }));
   await sleep(12000);
  }
 } finally { await lock.close(); await unlink(`${folder}/.analysis-stream.lock`); }
}
main().catch(()=>{console.error('Streaming classification stopped; resume with results:classify.');process.exitCode=1;});
