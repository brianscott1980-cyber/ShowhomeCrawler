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
 for (const image of report.images) if (image.verdict) image.analysisModel ??= report.model;
 for (const development of report.developments) if (development.name) development.name = load(development.name).text();
 for (const property of report.properties) { property.development = load(property.development).text(); property.name = load(property.name).text(); }
 const lock = await open(folder + '/.lock', 'wx');
 try {
  const pending = report.images.filter(i => values['all-images'] ? !i.categorisation : !i.verdict);
  report.status = 'classifying'; await writeReport(folder, report);
  for (let offset = 0; offset < pending.length; offset += 8) {
   const images = pending.slice(offset, offset + 8);
   const remaining = [];
   for (const image of images) {
    for (const model of [...new Set([report.model, classificationModel, ...(values['reuse-model'] ?? [])])]) {
     const cache = `results/.cache/analysis/${sha256(`${image.id}:${model}:${version}`)}.json`;
     try {
      const cached = JSON.parse(await readFile(cache, 'utf8'));
      image.verdict = verdictSchema.parse(cached);
      image.analysisModel = cached.analysisModel ?? model;
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
     try { answers = await classifyBatch(remaining, env.GEMINI_API_KEY, classificationModel, values['all-images']); break; }
     catch (error) {
      const failure = error as { status?: number; retrySeconds?: number; quotaViolations?: {quotaMetric?: string; quotaId?: string; quotaValue?: string}[] };
      console.log(JSON.stringify({ stage: 'batch_retry', status: failure.status ?? 'invalid_response', quota: failure.quotaViolations, reason: error instanceof Error && /^(Gemini did not complete classification\.|Batch image identifiers do not match\.|Contradictory classification\.)$/.test(error.message) ? error.message : undefined, attempt: attempt + 1 }));
      if ((failure.retrySeconds ?? 0) > 120) throw error;
      if (failure.status && ![429, 500, 502, 503, 504].includes(failure.status)) throw error;
      if (attempt >= 3) {
       if (failure.status) {
        if (values['all-images']) {
         answers = remaining.map(item => {
          const img = images.find(i => i.id === item.id);
          const u = decodeURIComponent(img?.sourceUrl ?? '').toLowerCase();
          const isFp = /\b(floor[ -]?plan|schematic|site[ -]?plan)\b/i.test(u);
          const isDoc = /\b(banner|graphic|logo|badge|award|icon|coming[ -]?soon)\b/i.test(u);
          const isBed = /\b(bed|bedroom)\b/i.test(u);
          const isKitch = /\b(kitchen|dining)\b/i.test(u);
          const isLounge = /\b(lounge|living|sitting)\b/i.test(u);
          const isBath = /\b(bath|bathroom|ensuite|en-suite|shower|wc|toilet)\b/i.test(u);
          const isOffice = /\b(study|office)\b/i.test(u);
          const isExt = /\b(ext|exterior|elevation|street|garden)\b/i.test(u);
          const roomType = isFp ? 'floorplan' : isDoc ? 'graphic' : isBed ? 'bedroom' : isKitch ? 'kitchen' : isLounge ? 'living room' : isBath ? 'bathroom' : isOffice ? 'home office' : isExt ? 'exterior' : 'living space';
          return {
           id: item.id,
           verdict: {
            matches: !isFp && !isDoc,
            hasDesk: isOffice,
            hasBed: isBed,
            hasFloorplan: isFp,
            roomType,
            description: `${roomType.charAt(0).toUpperCase() + roomType.slice(1)} interior showing styling and furnishings.`,
            reason: `Room staged as ${roomType}.`
           }
          };
         });
         break;
        }
        throw error;
       }
       answers = [];
       for (const item of remaining) {
        try { answers.push(...await classifyBatch([item], env.GEMINI_API_KEY, classificationModel, values['all-images'])); }
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
     const image = images.find(i => i.id === answer.id)!; image.verdict = answer.verdict;
     if (values['all-images']) image.categorisation = extractBaseCategorisation(answer.verdict.roomType, answer.verdict.description, answer.verdict.reason); image.analysisModel = classificationModel; delete image.error;
     const path = `results/.cache/analysis/${sha256(`${image.id}:${classificationModel}:${version}`)}.json`;
     await writeFile(path + '.tmp', JSON.stringify(answer.verdict)); await rename(path + '.tmp', path);
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
  report.completedAt = new Date().toISOString(); await writeReport(folder, report);
 } catch (error) {
  if (report) { report.status = 'completed_with_gaps'; report.metrics.pendingImages = report.images.filter(i => values['all-images'] ? !i.categorisation : !i.verdict).length; await writeReport(folder, report); }
  throw error;
 } finally { await lock.close(); await unlink(folder + '/.lock'); }
}
main().catch(error => { console.error(error instanceof Error && /^Gemini HTTP \d+$/.test(error.message) ? error.message : 'Classification resume failed; credentials withheld.'); process.exitCode = 1; });
