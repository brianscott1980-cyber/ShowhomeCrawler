import postgres from 'postgres';
import { requireDatabaseUrl } from '../config/env.js';
export function createDatabase(purpose: 'runtime' | 'migration' = 'runtime') {
 return postgres(requireDatabaseUrl(purpose), { max: 3, ssl: 'require', connect_timeout: 15, idle_timeout: 20, prepare: false });
}
