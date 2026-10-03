import { isInferredAnalysis } from '../vision/analysis-provenance.js';
import { mkdir, readFile, copyFile, rm, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { writeReport, type RunReport } from '../reports/report.js';
const { values } = parseArgs({ options: { builder: { type: 'string' } } });
if (!values.builder || !/^[a-z][a-z-]+$/.test(values.builder)) throw new Error('Builder slug required.');
const source = resolve('results', `${values.builder}-home-offices`);
const target = resolve('collections', `${values.builder}-home-offices`);
const report: RunReport = JSON.parse(await readFile(`${source}/results.json`, 'utf8'));
if (report.analysisVersion === 'all-property-images-v1' && report.images.some(i => !i.categorisation)) throw new Error('Finish all-image categorisation before publishing.');
if (report.images.some(i => isInferredAnalysis(i.verdict))) throw new Error('Replace filename-inferred labels with genuine image analysis before publishing.');
if (report.images.some(i => !i.verdict)) throw new Error('Finish classification before publishing.');
const publishedImages = report.images.filter(i => i.categorisation || i.verdict?.matches);
for (const image of publishedImages) {
 if (!/^images\/[a-f0-9]{64}\.(jpg|jpeg|png|webp|avif|gif|tiff)$/.test(image.path)) throw new Error('Invalid image path.');
 await access(`${source}/${image.path}`);
}
await mkdir(target, { recursive: true });
await mkdir(`${target}/images`, { recursive: true });
for (const image of publishedImages) await copyFile(`${source}/${image.path}`, `${target}/${image.path}`);
await writeReport(target, { ...report, images: report.images, properties: report.properties, metrics: { ...report.metrics, collectedUniqueImages: report.images.length } });
await rm(`${target}/checkpoint.json`, { force: true });
console.log(JSON.stringify({ stage: 'published_collection', developer: report.builder?.name, images: report.images.length, publishedImages: publishedImages.length, folder: target }));
