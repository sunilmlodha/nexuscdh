#!/usr/bin/env node
/**
 * Migration runner — replaces hand-pasting schema_vN.sql.
 *
 *   DATABASE_URL=postgres://... node scripts/migrate.mjs          # apply pending
 *   DATABASE_URL=postgres://... node scripts/migrate.mjs status   # list state
 *   DATABASE_URL=postgres://... node scripts/migrate.mjs baseline  # mark all as applied (no run)
 *
 * Applies files in supabase/migrations/*.sql in lexical order, each in its own
 * transaction, recording applied versions in a schema_migrations table so each
 * runs exactly once. New schema change = drop a NNNN_name.sql file in there.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const cmd = process.argv[2] ?? 'up';
const url = process.env.DATABASE_URL;

if (!url) {
  console.error('DATABASE_URL not set. Supabase → Settings → Database → Connection string (use the pooler/session URI).');
  process.exit(1);
}

const files = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort();
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

await client.connect();
await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
const { rows } = await client.query('SELECT version FROM schema_migrations');
const applied = new Set(rows.map(r => r.version));

if (cmd === 'status') {
  for (const f of files) console.log(`${applied.has(f) ? '✓ applied ' : '· pending '} ${f}`);
  await client.end();
  process.exit(0);
}

if (cmd === 'baseline') {
  for (const f of files) {
    if (!applied.has(f)) await client.query('INSERT INTO schema_migrations(version) VALUES ($1) ON CONFLICT DO NOTHING', [f]);
  }
  console.log(`Baselined ${files.length} migration(s) as applied (no SQL run).`);
  await client.end();
  process.exit(0);
}

let count = 0;
for (const f of files) {
  if (applied.has(f)) continue;
  const sql = readFileSync(join(DIR, f), 'utf8');
  process.stdout.write(`applying ${f} … `);
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [f]);
    await client.query('COMMIT');
    console.log('ok');
    count++;
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(`FAILED\n${e.message}`);
    await client.end();
    process.exit(1);
  }
}
console.log(count ? `Applied ${count} migration(s).` : 'Already up to date.');
await client.end();
