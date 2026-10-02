import { it, expect } from 'vitest';
import { readFile, access, readdir } from 'node:fs/promises';
import type { RunReport } from '../src/reports/report';
it('ships every matched image referenced by published developer cards', async () => {
 const folders = await readdir('collections');
 expect(folders.length).toBeGreaterThan(0);
 for (const folder of folders) {
  const report: RunReport = JSON.parse(await readFile(`collections/${folder}/results.json`, 'utf8'));
  const images = new Map(report.images.map(i => [i.id, i]));
  for (const image of report.images) {
   expect(image.verdict?.matches).toBe(true);
   await access(`collections/${folder}/${image.path}`);
  }
  for (const property of report.properties) for (const id of property.imageIds) expect(images.has(id)).toBe(true);
 }
});
