# SSO + RBAC setup (Google & Microsoft)

NexusCDH uses **Supabase Auth** for Google and Microsoft (Azure) sign-in, and a
`user_roles` table for role-based access. SSO is **additive**: with no session
the app runs in demo mode (full access); once a user signs in, their real role
is enforced and offerings are gated by permission.

## 1. Run the migration
Run `supabase/schema_v14.sql` in the Supabase SQL editor. It creates `user_roles`
and seeds `slodha@wearedcs.com` as `tenant_admin` so you're not locked out
(edit that line to your own email first, or promote yourself later).

## 2. Create the OAuth apps (you do this — secrets are yours)

**Google** — Google Cloud Console → APIs & Services → Credentials → *Create
OAuth client ID* (Web application). Authorized redirect URI:
```
https://kyczcfwmvcmluytwmqbj.supabase.co/auth/v1/callback
```
Copy the Client ID + Client Secret.

**Microsoft** — Azure Portal → App registrations → *New registration*. Redirect
URI (Web):
```
https://kyczcfwmvcmluytwmqbj.supabase.co/auth/v1/callback
```
Under *Certificates & secrets* create a client secret. Note the Application
(client) ID, the secret value, and your Directory (tenant) ID.

## 3. Enable the providers in Supabase
Supabase dashboard → **Authentication → Providers**:
- **Google**: paste the Client ID + Secret, enable.
- **Azure**: paste the Application ID + Secret; set the Azure Tenant URL to
  `https://login.microsoftonline.com/<tenant-id>` (or `…/common` for multi-tenant).

Then **Authentication → URL Configuration → Redirect URLs**, add:
```
https://nexuscdh.vercel.app/auth/callback
http://localhost:3000/auth/callback
```
(Site URL: `https://nexuscdh.vercel.app`.)

## 4. No app env vars needed
Auth uses the existing `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
Provider secrets live in Supabase, not in the app.

## 5. How roles work
- First sign-in creates a `user_roles` row defaulting to **read_only**.
- A **Tenant Admin / Super Admin** assigns roles in **Users & Roles** (or via
  `POST /api/user-roles`).
- The sidebar only shows offerings the role can access; **approve/deploy** in
  1:1 Operations requires `operations:write` (Ops Manager / Tenant Admin /
  Super Admin), with segregation of duties.

## Database-level tenant isolation (RLS) — activation order
App-layer authz is enforced now (every write route runs `requireAuth`, tenant
comes from the session). For *database-level* isolation:
1. Run `supabase/schema_v15_rls.sql` — safe anytime; it's a no-op today because
   the service-role key bypasses RLS. It adds `app_current_tenant()` + a
   `tenant_isolation` policy on every tenant table.
2. Set `ENFORCE_AUTH=true` (only after SSO providers are live).
3. Adopt `dbFor(ctx)` (lib/db.ts) in route reads/writes — for authenticated
   requests it uses the session client, so Postgres denies cross-tenant rows
   even if app code forgets a tenant filter. Roll out per route and verify with
   real sessions.

## Roles → access (summary)
- **Super Admin / Tenant Admin** — everything, incl. approvals & user management
- **Ops Manager** — operations + approvals (operations:write)
- **Strategy Manager** — taxonomy/strategies/policies/experiments (write)
- **Campaign Analyst** — read + simulator
- **Channel Manager** — channels/policies (write)
- **Data Scientist** — models/audiences (write), profiles
- **Read Only** — view only
