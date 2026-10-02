import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { readEnv } from '../config/env.js';
import { parseDevelopment } from '../adapters/bellway/bellway-parser.js';
import { createDatabase } from '../database/postgres.js';
import { PostgresCatalogRepository } from '../database/repositories/postgres-catalog-repository.js';
const sample = 'https://www.bellway.co.uk/new-homes/scotland-west/dargavel-village';
async function main() {
 const { values } = parseArgs({ options: { fixture: { type: 'boolean' }, development: { type: 'string' }, persist: { type: 'boolean' } } });
 const url = values.development ?? sample;
 const parsed = new URL(url);
 if (parsed.origin !== 'https://www.bellway.co.uk' || !/^\/new-homes\/[^/]+\/[^/]+$/.test(parsed.pathname) || parsed.search || parsed.hash) throw new Error('Expected one canonical Bellway development URL.');
 const env = readEnv();
 let html: string;
 if (values.fixture) {
  if (url !== sample) throw new Error('Fixture mode supports the sample development only.');
  html = await readFile('test/fixtures/bellway/development.html', 'utf8');
 } else {
  const response = await fetch(url, { signal: AbortSignal.timeout(env.REQUEST_TIMEOUT_MS), redirect: 'error', headers: { 'User-Agent': 'ShowhomeCrawler/0.1 (single-development source investigation)' } });
  if (!response.ok) throw new Error('Development request failed.');
  html = await response.text();
 }
 const result = parseDevelopment(html, url);
 result.properties = result.properties.slice(0, env.MAX_PROPERTIES);
 console.log(JSON.stringify(result, null, 2));
 if (values.persist) {
  const sql = createDatabase();
  try { console.log(JSON.stringify(await new PostgresCatalogRepository(sql, { name: 'Bellway', slug: 'bellway', websiteUrl: 'https://www.bellway.co.uk' }).saveDevelopment(result.development, result.properties))); }
  finally { await sql.end(); }
 }
}
main().catch(() => { console.error('Discovery failed. Check the URL, source format and local environment. Connection details are withheld.'); process.exitCode = 1; });
