import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createDatabase } from '../database/postgres.js';
async function main() {
 const sql = createDatabase('migration');
 try {
  await sql.begin('read write',async tx => {
   await tx`select pg_advisory_xact_lock(726391041)`;
   await tx`create schema if not exists showhome_internal`;
   await tx`create table if not exists showhome_internal.migrations (name text primary key, sha256 text not null, applied_at timestamptz not null default now())`;
  });
   const files = (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort();
   for (const name of files) {
    await sql.begin('read write',async tx=>{
     await tx`set local lock_timeout='5s'`;
     await tx`set local statement_timeout='5min'`;
     await tx`select pg_advisory_xact_lock(726391041)`;
     await tx`select pg_advisory_xact_lock(726391042)`;
    const source = await readFile(`supabase/migrations/${name}`, 'utf8');
    const checksum = createHash('sha256').update(source).digest('hex');
    const existing = await tx`select sha256 from showhome_internal.migrations where name = ${name}`;
    if (existing.length) {
     if (existing[0]?.sha256 !== checksum) throw new Error('An applied migration was changed.');
     return;
    }
    console.log(`Applying ${name}`);
    await tx.unsafe(source);
    await tx`insert into showhome_internal.migrations(name, sha256) values (${name}, ${checksum})`;
    console.log(`Applied ${name}`);
    });
   }
 } finally { await sql.end(); }
}
main().catch((error) => { console.error('Migration failed:',error.code??'unknown',(error.message??'').replace(/postgres(?:ql)?:\/\/\S+/g,'[connection withheld]')); process.exitCode = 1; });
