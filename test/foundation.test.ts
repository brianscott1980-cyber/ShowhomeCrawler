import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { readEnv, requireDatabaseUrl } from '../src/config/env.js';
import { parseDevelopment, parsePrice } from '../src/adapters/bellway/bellway-parser.js';
import { PostgresCatalogRepository } from '../src/database/repositories/postgres-catalog-repository.js';
import type postgres from 'postgres';
const url = 'https://www.bellway.co.uk/new-homes/scotland-west/dargavel-village';
const fixture = await readFile('test/fixtures/bellway/development.html', 'utf8');
describe('environment', () => {
 it('has conservative defaults and parses false correctly', () => { const env = readEnv({}); expect(env.STORE_IMAGES).toBe(false); expect(env.MAX_CONCURRENCY).toBe(3); expect(env.MAX_PROPERTIES).toBe(10); });
 it('rejects invalid configuration without exposing values', () => { expect(() => readEnv({ MAX_CONCURRENCY: 'secret' })).toThrow('Invalid environment variables: MAX_CONCURRENCY'); expect(() => readEnv({ STORE_IMAGES: 'yes' })).toThrow(); });
});
describe('connection routing', () => {
 const runtime = 'postgresql://user:placeholder@localhost:6543/postgres?pgbouncer=true';
 const direct = 'postgresql://user:placeholder@localhost:5432/postgres';
 it('selects the correct connection for runtime and migration', () => {
  const env = { DATABASE_URL: runtime, DIRECT_URL: direct };
  expect(requireDatabaseUrl('runtime', env)).toBe(runtime);
  expect(requireDatabaseUrl('migration', env)).toBe(direct);
 });
 it('requires a separate migration connection', () => {
  expect(() => requireDatabaseUrl('migration', { DATABASE_URL: runtime })).toThrow('Set DIRECT_URL');
 });
 it('rejects transaction-mode migration connections without exposing credentials', () => {
  expect(() => requireDatabaseUrl('migration', { DIRECT_URL: runtime })).toThrow('DIRECT_URL must be a PostgreSQL connection URI using a direct or session-mode connection.');
 });
 it('rejects non-Postgres connection URIs', () => {
  expect(() => requireDatabaseUrl('runtime', { DATABASE_URL: 'https://example.com' })).toThrow('DATABASE_URL must be a PostgreSQL connection URI.');
 });
});
describe('observed Bellway fixture', () => {
 it('extracts the development and distinct plots', () => {
  const data = parseDevelopment(fixture, url);
  expect(data.development.name).toBe('Dargavel Village'); expect(data.development.postcode).toBe('PA7 5HP');
  expect(data.properties).toHaveLength(3);
  expect(data.properties.find(p => p.plotNumber === '201')).toMatchObject({ name: 'The Sunningdale', bedrooms: 5, price: 539995, isDetached: true, available: true });
 });
 it('fails visibly when plot data is absent', () => { expect(() => parseDevelopment(fixture.replaceAll('developmentSiteplan', 'changed'), url)).toThrow(); });
 it('parses prices and preserves unknown values', () => { expect(parsePrice('£539,995')).toBe(539995); expect(parsePrice('POA')).toBeNull(); expect(parsePrice(null)).toBeNull(); });
});
describe('migration and repository against PostgreSQL engine', () => {
 const db = new PGlite();
 beforeAll(async () => { await db.exec(await readFile('supabase/migrations/20261002000100_foundation.sql', 'utf8')); await db.exec(await readFile('supabase/migrations/20261002000200_image_classifications.sql', 'utf8')); await db.exec(await readFile('supabase/migrations/20261002000300_site_filtering.sql', 'utf8')); });
 afterAll(async () => { await db.close(); });
 // Execute the repository's actual SQL, including its conflict targets and transaction.
 const connection = { json: (value: unknown) => JSON.stringify(value), begin: async (fn: (tx: unknown) => Promise<unknown>) => db.transaction(async tx => fn(Object.assign(async (parts: TemplateStringsArray, ...values: unknown[]) => {
  const query = parts.reduce((out, part, i) => out + (i ? `$${i}` : '') + part, '');
  return (await tx.query(query, values)).rows;
 }, { unsafe: async (query: string, values: unknown[]) => (await tx.query(query, values)).rows }))) } as unknown as postgres.Sql;
 it('upserts repeated plots without duplicates and updates price', async () => {
  const data = parseDevelopment(fixture, url);
  const repo = new PostgresCatalogRepository(connection, { name: 'Bellway', slug: 'bellway', websiteUrl: 'https://www.bellway.co.uk' });
  await repo.saveDevelopment(data.development, data.properties);
  data.properties[0]!.price = 500000;
  await repo.saveDevelopment(data.development, data.properties);
  const count = await db.query<{ count: number }>('select count(*)::int as count from property_listings');
  expect(count.rows[0]!.count).toBe(3);
  const price = await db.query<{ price: string }>('select price from property_listings where external_id = $1', [data.properties[0]!.externalId]);
  expect(Number(price.rows[0]!.price)).toBe(500000);
  expect((await db.query('select * from house_types')).rows).toHaveLength(2);
 });
 it('rolls back a failed catalogue write', async () => {
  const data = parseDevelopment(fixture, url);
  await expect(new PostgresCatalogRepository(connection, { name: 'Bellway', slug: 'bellway', websiteUrl: 'https://www.bellway.co.uk' }).saveDevelopment({ ...data.development, url: url + '-invalid' }, [{ ...data.properties[0]!, bedrooms: -1 }])).rejects.toThrow();
  expect((await db.query('select * from developments')).rows).toHaveLength(1);
 });
 it('enables RLS on every application table', async () => {
  const tables = await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'public' and relkind = 'r'");
  expect(tables.rows).toHaveLength(11); expect(tables.rows.every(t => t.relrowsecurity)).toBe(true);
 });
 it('rejects invalid crawl states', async () => {
  await expect(db.query("insert into crawl_jobs(builder_id,status) select id,'oops' from builders")).rejects.toThrow();
 });
 it('persists false classifications once and rejects contradictory positives', async () => {
  const image = await db.query<{id:string}>("insert into images(source_url,sha256) values ('https://example.test/a.jpg',$1) returning id", ['a'.repeat(64)]);
  const id=image.rows[0]!.id;
  const query="insert into image_classifications(image_id,question,question_version,ai_model,matches,has_desk,has_bed,reason) values ($1,'Home office with no beds','v1','test',false,true,true,'Bed visible') on conflict(image_id,question_version,ai_model) do nothing";
  await db.query(query,[id]); await db.query(query,[id]);
  expect((await db.query<{matches:boolean}>('select matches from image_classifications')).rows).toEqual([{matches:false}]);
  await expect(db.query("insert into image_classifications(image_id,question,question_version,ai_model,matches,has_desk,has_bed,reason) values ($1,'Office','v2','test',true,true,true,'Contradiction')",[id])).rejects.toThrow();
 });

});
