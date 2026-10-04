import {hasSiteCategorisation} from '../vision/site-categorisation.js';
import {GeminiModelPool,classificationModels} from '../vision/gemini-model-pool.js';
import {saveGeminiState} from '../reports/gemini-status.js';
import { isInferredAnalysis } from '../vision/analysis-provenance.js';
import { readFile, writeFile, rename, open, unlink } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { load } from 'cheerio';
import { setTimeout as sleep } from 'node:timers/promises';
import { extractBaseCategorisation } from '../vision/image-categoriser.js';
import { readEnv } from '../config/env.js';
import { sha256 } from '../galleries/image-hasher.js';
import { analysisVersion, classifyBatch, verdictSchema } from '../vision/gemini-classifier.js';
import { writeReport, type RunReport } from '../reports/report.js';
async function main() {
 const { values } = parseArgs({ options: { 'reuse-model': {type:'string',multiple:true}, 'all-images': {type:'boolean'}, model: {type:'string'}, folder: { type: 'string', default: 'results/bellway-home-offices' } } });
 const folder = values.folder, env = readEnv();
 if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY required.');
 const report: RunReport = JSON.parse(await readFile(folder + '/results.json', 'utf8'));
 const version = values['all-images'] ? 'all-property-images-v1' : analysisVersion;
 if (values['all-images']) { report.question = 'All property gallery images'; report.analysisVersion = version; }
 const classificationModel = values.model ?? report.model;
 const pool=new GeminiModelPool(classificationModels(classificationModel));
 const classifyWithFallback=async(items:Parameters<typeof classifyBatch>[0])=>{
  const result=await pool.run(model=>classifyBatch(items,env.GEMINI_API_KEY!,model,values['all-images']),async()=>{const snapshot=pool.snapshot();const waiting=snapshot.modelStates.every(m=>m.status!=='ready');await saveGeminiState(folder,{state:waiting?'quota_wait':'analysing',model:pool.currentModel,...snapshot});});
  return result.value.map(answer=>({...answer,analysisModel:result.model}));
 };
 for (const image of report.images) {
  if (values['all-images']&&hasSiteCategorisation(image))continue;
  if (isInferredAnalysis(image.verdict)) { delete image.verdict; delete image.categorisation; delete image.analysisModel; }
  if (image.verdict) image.analysisModel ??= report.model;
 }
 for (const development of report.developments) if (development.name) development.name = load(development.name).text();
 for (const property of report.properties) { property.development = load(property.development).text(); property.name = load(property.name).text(); }
 const lock = await open(folder + '/.lock', 'wx');
 try {
  const pending = report.images.filter(i => values['all-images'] ? !i.categorisation : !i.verdict);
  await saveGeminiState(folder,{state:'analysing',model:pool.currentModel,...pool.snapshot()});
  report.metrics.skippedExistingAnalyses=report.images.length-pending.length;
  report.metrics.analysisCacheHits=0;
  report.status = 'classifying'; await writeReport(folder, report);
  for (let offset = 0; offset < pending.length; offset += 8) {
   const images = pending.slice(offset, offset + 8);
   const remaining = [];
   for (const image of images) {
    for (const model of [...new Set([...pool.models,report.model,...(values['reuse-model'] ?? [])])]) {
     const cache = `results/.cache/analysis/${sha256(`${image.id}:${model}:${version}`)}.json`;
     try {
      const cached = JSON.parse(await readFile(cache, 'utf8'));
      if (isInferredAnalysis(cached)) continue;
      image.verdict = verdictSchema.parse(cached);
      image.analysisModel = cached.analysisModel ?? model;
      report.metrics.analysisCacheHits++;
      delete image.error;
      if (values['all-images']) image.categorisation = cached.categorisation ?? extractBaseCategorisation(image.verdict.roomType, image.verdict.description, image.verdict.reason);
      break;
     } catch {}
    }
    if (values['all-images'] ? !image.categorisation : !image.verdict) remaining.push({ id: image.id, bytes: await readFile(folder + '/' + image.path) });
   }
   if (remaining.length) {
    let answers;
    for (let attempt = 0; ; attempt++) {
     await saveGeminiState(folder,{state:'analysing',model:pool.currentModel,...pool.snapshot()});
     try { answers = await classifyWithFallback(remaining); break; }
     catch (error) {
      const failure = error as { status?: number; retrySeconds?: number; quotaViolations?: {quotaMetric?: string; quotaId?: string; quotaValue?: string}[] };
      const isRateLimit = failure.status === 429 || /rate|quota|exhausted|429/i.test(String(error));
      console.log(JSON.stringify({ stage: 'batch_retry', status: failure.status ?? 'invalid_response', quota: failure.quotaViolations, reason: error instanceof Error && /^(Gemini did not complete classification\.|Batch image identifiers do not match\.|Contradictory classification\.)$/.test(error.message) ? error.message : undefined, attempt: attempt + 1 }));
      if (isRateLimit) {
       console.log('All available Gemini models are quota limited. Pausing for 2 minutes before retrying...');
       const delaySeconds = 120;
       await saveGeminiState(folder,{state:'quota_wait',model:pool.currentModel,...pool.snapshot(),httpStatus:429,retryAt:new Date(Date.now()+delaySeconds*1000).toISOString()});
       await writeReport(folder,report);
       for (let seconds = 0; seconds < delaySeconds; seconds += 10) await sleep(Math.min(10, delaySeconds - seconds) * 1000);
       continue;
      }
      if (failure.status && ![429, 500, 502, 503, 504].includes(failure.status)) throw error;
      if (attempt >= 3) {
       if (failure.status) {
        throw error;
       }
       answers = [];
       for (const item of remaining) {
        try { answers.push(...await classifyWithFallback([item])); }
        catch { const image = images.find(i=>i.id===item.id)!; image.error='Individual classification failed after batch retries'; report.errors.push({url:image.sourceUrl,stage:'classification',message:image.error}); }
        await sleep(4000);
       }
       break;
      }
      // Sleep in small intervals so cancellation and progress remain responsive.
      await saveGeminiState(folder,{state:'retrying',model:pool.currentModel,...pool.snapshot(),httpStatus:failure.status});
      const delay = Math.min(120, Math.max(10, failure.retrySeconds ?? 10 * 2 ** attempt));
      for (let seconds = 0; seconds < delay; seconds += 10) await sleep(Math.min(10, delay - seconds) * 1000);
     }
    }
    for (const answer of answers) {
     const image = images.find(i => i.id === answer.id)!; image.verdict = answer.verdict;
     if (values['all-images']) image.categorisation = extractBaseCategorisation(answer.verdict.roomType, answer.verdict.description, answer.verdict.reason); image.analysisModel = answer.analysisModel; delete image.error;
     const path = `results/.cache/analysis/${sha256(`${image.id}:${answer.analysisModel}:${version}`)}.json`;
     await writeFile(path + '.tmp', JSON.stringify({...answer.verdict,analysisModel:answer.analysisModel})); await rename(path + '.tmp', path);
    }
   }
   report.errors = report.errors.filter(error => error.stage !== 'classification' || !report.images.find(i => i.sourceUrl === error.url)?.verdict);
   report.metrics.pendingImages = report.images.filter(i => values['all-images'] ? !i.categorisation : !i.verdict).length;
   report.metrics.matchedImages = report.images.filter(i => i.verdict?.matches).length;
   await writeReport(folder, report);
   console.log(JSON.stringify({ stage: 'batch_complete', processed: Math.min(offset + 8, pending.length), total: pending.length, matches: report.metrics.matchedImages }));
   if (remaining.length) await sleep(4000);
  }
  report.status = report.errors.length || report.metrics.pendingImages || report.metrics.propertyLimitOmissions || report.metrics.imageLimitOmissions || report.metrics.developmentLimitOmissions ? 'completed_with_gaps' : 'completed';
  await saveGeminiState(folder,{state:'complete',model:pool.currentModel,...pool.snapshot()});
  report.completedAt = new Date().toISOString(); await writeReport(folder, report);
 } catch (error) {
  if (report) { report.status = 'completed_with_gaps'; report.metrics.pendingImages = report.images.filter(i => values['all-images'] ? !i.categorisation : !i.verdict).length; await writeReport(folder, report); }
  throw error;
 } finally { await lock.close(); await unlink(folder + '/.lock'); }
}
main().catch(error => { console.error(error instanceof Error && /^Gemini HTTP \d+$/.test(error.message) ? error.message : 'Classification resume failed; credentials withheld.'); process.exitCode = 1; });
