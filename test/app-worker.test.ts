import { it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';

it('runs discovery then batch analysis in a detached-worker entrypoint and releases its lock', async () => {
 const folder = await mkdtemp(join(tmpdir(), 'showhome-worker-'));
 try {
  await mkdir(join(folder, 'src/cli'), { recursive: true });
  await mkdir(join(folder, 'results/.app-job'), { recursive: true });
  await symlink(resolve('node_modules'), join(folder, 'node_modules'));
  const stub = `import {appendFileSync} from 'node:fs'; appendFileSync('commands.jsonl', JSON.stringify(process.argv.slice(1))+'\\n');`;
  await writeFile(join(folder, 'src/cli/crawl.ts'), stub);
  await writeFile(join(folder, 'src/cli/classify-results.ts'), stub);
  await writeFile(join(folder, 'results/.app-job.json'), JSON.stringify({ id: 'fixture', developer: 'cala', action: 'crawl', status: 'queued', startedAt: new Date().toISOString() }));
  const input = { developer: 'cala', action: 'crawl', maxDevelopments: 2, maxProperties: 3, maxImages: 4 };
  const exit = await new Promise<number | null>((accept, reject) => {
   const child = spawn(process.execPath, ['--import', 'tsx', resolve('src/cli/app-job.ts'), JSON.stringify(input), 'fixture'], { cwd: folder, env: { ...process.env, GEMINI_API_KEY: 'fixture-only' }, stdio: 'ignore' });
   child.once('error', reject); child.once('exit', accept);
  });
  expect(exit).toBe(0);
  const commands = (await readFile(join(folder, 'commands.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line) as string[]);
  expect(commands).toHaveLength(2);
  expect(commands[0]).toContain('--discover-only');
  expect(commands[0]).toContain('results/cala-home-offices');
  expect(commands[1]?.[0]).toContain('classify-results.ts');
  expect(JSON.parse(await readFile(join(folder, 'results/.app-job.json'), 'utf8')).status).toBe('completed');
  await expect(access(join(folder, 'results/.app-job'))).rejects.toThrow();
 } finally { await rm(folder, { recursive: true, force: true }); }
});
