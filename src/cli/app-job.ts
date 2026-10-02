import { spawn } from 'node:child_process';
import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AppJob, JobInput } from '../models/app-job.js';

const input = JSON.parse(process.argv[2]!) as JobInput;
const job: AppJob = JSON.parse(await readFile('results/.app-job.json', 'utf8'));
if (job.id !== process.argv[3]) process.exit(1);
async function save() {
 await writeFile('results/.app-job.json.tmp', JSON.stringify(job));
 await rename('results/.app-job.json.tmp', 'results/.app-job.json');
}
async function command(file: string, args: string[]) {
 await new Promise<void>((accept, reject) => {
  const child = spawn(process.execPath, ['--import', 'tsx', resolve('src/cli', file), ...args], { stdio: 'ignore' });
  child.once('error', reject);
  child.once('exit', code => code === 0 ? accept() : reject(new Error('Processing failed. Check the collection coverage and local environment settings.')));
 });
}
try {
 job.pid = process.pid; job.status = input.action === 'crawl' ? 'discovering' : 'classifying'; await save();
 const folder = `results/${input.developer}-home-offices`;
 if (input.action === 'crawl') {
  await command('crawl.ts', ['--builder', input.developer, '--output', folder, '--discover-only', '--max-developments', String(input.maxDevelopments), '--max-properties', String(input.maxProperties), '--max-images', String(input.maxImages)]);
 }
 // Discovery is useful without a Gemini key; classification can be resumed later.
 const { readEnv } = await import('../config/env.js');
 if (input.action === 'classify' || readEnv().GEMINI_API_KEY) {
  job.status = 'classifying'; await save();
  await command('classify-results.ts', ['--folder', folder]);
 }
 job.status = 'completed';
} catch { job.status = 'failed'; job.error = 'Processing failed. Review coverage and verify your local environment settings.'; }
finally { job.completedAt = new Date().toISOString(); await save(); await rm('results/.app-job', { recursive: true, force: true }); }
