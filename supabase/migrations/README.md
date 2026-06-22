# Migrations

Tracked, run-once SQL migrations — replaces hand-pasting `schema_vN.sql` into the
dashboard. The runner records applied versions in a `schema_migrations` table so
each file runs exactly once.

## Setup (one-time)
Set the Postgres connection string (Supabase → Settings → Database → Connection
string → **URI**, prefer the *Session pooler* for IPv4). It contains your DB
password, so keep it out of git — set it in your shell or Vercel env, never a
committed file:

```sh
export DATABASE_URL='postgresql://postgres.kyczcfwmvcmluytwmqbj:[YOUR-DB-PASSWORD]@aws-0-<region>.pooler.supabase.com:6543/postgres'
```

The legacy `schema.sql … schema_v15_rls.sql` were applied by hand. Mark them as a
baseline so the runner won't touch them, then this folder governs everything new:

```sh
npm run migrate:baseline   # records existing migrations/*.sql as applied (no SQL run)
```

## Day to day
```sh
npm run migrate:status     # show applied / pending
npm run migrate            # apply pending migrations (each in a transaction)
```

## Adding a change
Drop a new file named `NNNN_short_description.sql` (next number) here and run
`npm run migrate`. Write idempotent SQL (`IF NOT EXISTS`, `DROP … IF EXISTS`)
where practical. CI/CD or a deploy step can run `npm run migrate` once
`DATABASE_URL` is available as a secret.
