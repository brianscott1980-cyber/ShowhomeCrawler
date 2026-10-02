import { developers } from '../adapters/developers';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { collectionFolder } from './collections';
import type { AppJob, JobInput } from '../models/app-job';

export const jobInput = z.object({
 developer: z.enum(developers.map(d => d.slug)), action: z.enum(['crawl', 'classify']),
 maxDevelopments: z.number().int().min(1).max(1000).default(1000),
 maxProperties: z.number().int().min(1).max(10000).default(10000),
 maxImages: z.number().int().min(1).max(20000).default(20000),
});
const lock = resolve('results/.app-job');
export async function readJob(): Promise<AppJob | null> {
 try { return JSON.parse(await readFile(resolve('results/.app-job.json'), 'utf8')); }
 catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
export async function startJob(input: JobInput) {
 collectionFolder(input.developer);
 await mkdir('results', { recursive: true });
 try { await mkdir(lock); } catch { throw new Error('A processing job is already running.'); }
 const job: AppJob = { id: randomUUID(), developer: input.developer, action: input.action, status: 'queued', startedAt: new Date().toISOString() };
 try {
  await writeFile('results/.app-job.json', JSON.stringify(job));
  const child = spawn(process.execPath, ['--import', 'tsx', resolve('src/cli/app-job.ts'), JSON.stringify(input), job.id], { cwd: process.cwd(), detached: true, stdio: 'ignore' });
  await new Promise<void>((accept, reject) => { child.once('spawn', accept); child.once('error', reject); });
  child.unref();
  return job;
 } catch (error) { await rm(lock, { recursive: true, force: true }); throw error; }
}
