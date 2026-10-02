import { readFile, writeFile, rename, open, unlink } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { load } from 'cheerio';
import { setTimeout as sleep } from 'node:timers/promises';
import { readEnv } from '../config/env.js';
import { sha256 } from '../galleries/image-hasher.js';
import { analysisVersion, classifyBatch, verdictSchema } from '../vision/gemini-classifier.js';
import { writeReport, type RunReport } from '../reports/report.js';
async function main() {
 const { values } = parseArgs({ options: { folder: { type: 'string', default: 'results/bellway-home-offices' } } });
 const folder = values.folder, env = readEnv();
 if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY required.');
 const report: RunReport = JSON.parse(await readFile(folder + '/results.json', 'utf8'));
 for (const development of report.developments) if (development.name) development.name = load(development.name).text();
 for (const property of report.properties) { property.development = load(property.development).text(); property.name = load(property.name).text(); }
 const lock = await open(folder + '/.lock', 'wx');
 try {
  const pending = report.images.filter(i => !i.verdict);
  report.status = 'classifying'; await writeReport(folder, report);
  for (let offset = 0; offset < pending.length; offset += 8) {
   const images = pending.slice(offset, offset + 8);
   const remaining = [];
   for (const image of images) {
    const cache = `results/.cache/analysis/${sha256(`${image.id}:${report.model}:${analysisVersion}`)}.json`;
    try { image.verdict = verdictSchema.parse(JSON.parse(await readFile(cache, 'utf8'))); delete image.error; }
    catch { remaining.push({ id: image.id, bytes: await readFile(folder + '/' + image.path) }); }
   }
   if (remaining.length) {
    let answers;
    for (let attempt = 0; ; attempt++) {
     try { answers = await classifyBatch(remaining, env.GEMINI_API_KEY, report.model); break; }
     catch (error) {
      const failure = error as { status?: number; retrySeconds?: number };
      console.log(JSON.stringify({ stage: 'batch_retry', status: failure.status ?? 'invalid_response', reason: error instanceof Error && /^(Gemini did not complete classification\.|Batch image identifiers do not match\.|Contradictory classification\.)$/.test(error.message) ? error.message : undefined, attempt: attempt + 1 }));
      if (failure.status && ![429, 500, 502, 503, 504].includes(failure.status)) throw error;
      if (attempt >= 3) {
       if (failure.status) throw error;
       answers = [];
       for (const item of remaining) {
        try { answers.push(...await classifyBatch([item], env.GEMINI_API_KEY, report.model)); }
        catch { const image = images.find(i=>i.id===item.id)!; image.error='Individual classification failed after batch retries'; report.errors.push({url:image.sourceUrl,stage:'classification',message:image.error}); }
        await sleep(4000);
       }
       break;
      }
      // Sleep in small intervals so cancellation and progress remain responsive.
      const delay = Math.min(120, Math.max(10, failure.retrySeconds ?? 10 * 2 ** attempt));
      for (let seconds = 0; seconds < delay; seconds += 10) await sleep(Math.min(10, delay - seconds) * 1000);
     }
    }
    for (const answer of answers) {
     const image = images.find(i => i.id === answer.id)!; image.verdict = answer.verdict; delete image.error;
     const path = `results/.cache/analysis/${sha256(`${image.id}:${report.model}:${analysisVersion}`)}.json`;
     await writeFile(path + '.tmp', JSON.stringify(answer.verdict)); await rename(path + '.tmp', path);
    }
   }
   report.errors = report.errors.filter(error => error.stage !== 'classification' || !report.images.find(i => i.sourceUrl === error.url)?.verdict);
   report.metrics.pendingImages = report.images.filter(i => !i.verdict).length;
   report.metrics.matchedImages = report.images.filter(i => i.verdict?.matches).length;
   await writeReport(folder, report);
   console.log(JSON.stringify({ stage: 'batch_complete', processed: Math.min(offset + 8, pending.length), total: pending.length, matches: report.metrics.matchedImages }));
   await sleep(4000);
  }
  report.status = report.errors.length || report.metrics.pendingImages || report.metrics.propertyLimitOmissions || report.metrics.imageLimitOmissions || report.metrics.developmentLimitOmissions ? 'completed_with_gaps' : 'completed';
  report.completedAt = new Date().toISOString(); await writeReport(folder, report);
 } catch (error) {
  if (report) { report.status = 'completed_with_gaps'; report.metrics.pendingImages = report.images.filter(i => !i.verdict).length; await writeReport(folder, report); }
  throw error;
 } finally { await lock.close(); await unlink(folder + '/.lock'); }
}
main().catch(error => { console.error(error instanceof Error && /^Gemini HTTP \d+$/.test(error.message) ? error.message : 'Classification resume failed; credentials withheld.'); process.exitCode = 1; });
