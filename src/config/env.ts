import { config } from 'dotenv';
import { z } from 'zod';
config({ path: '.env.local', quiet: true });
config({ quiet: true });
const positive = (value: number) => z.coerce.number().int().positive().default(value);
const schema = z.object({
 SUPABASE_URL: z.url().default('https://hnxrbhlffwmlymxflrdb.supabase.co'),
 SUPABASE_ANON_KEY: z.string().optional(), SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
 DATABASE_URL: z.string().optional(), DIRECT_URL: z.string().optional(),
 GEMINI_API_KEY: z.string().optional(), GEMINI_MODEL: z.string().optional(),
 STORE_IMAGES: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
 MAX_CONCURRENCY: positive(3), REQUEST_DELAY_MS: z.coerce.number().int().nonnegative().default(500),
 MAX_RETRIES: z.coerce.number().int().nonnegative().default(3), REQUEST_TIMEOUT_MS: positive(15000),
 MAX_DEVELOPMENTS: positive(1), MAX_PROPERTIES: positive(10),
});
export function readEnv(input: Record<string, string | undefined> = process.env) {
 const result = schema.safeParse(input);
 if (!result.success) throw new Error('Invalid environment variables: ' + result.error.issues.map(i => i.path.join('.')).join(', '));
 return result.data;
}
export function requireDatabaseUrl(purpose: 'runtime' | 'migration' = 'runtime', input: Record<string, string | undefined> = process.env): string {
 const name = purpose === 'migration' ? 'DIRECT_URL' : 'DATABASE_URL';
 const url = readEnv(input)[name];
 if (!url) throw new Error(`Set ${name} in your local environment before accessing the database.`);
 try {
  const parsed = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname) throw new Error();
  if (purpose === 'migration' && (parsed.port === '6543' || parsed.searchParams.get('pgbouncer') === 'true')) throw new Error();
 } catch { throw new Error(`${name} must be a PostgreSQL connection URI${purpose === 'migration' ? ' using a direct or session-mode connection' : ''}.`); }
 return url;
}
