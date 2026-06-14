-- NexusCDH Database Schema
-- Run this in your Supabase SQL editor to initialise the database
-- Project: NexusCDH Enterprise Customer Decision Hub

-- ── Extensions ────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Tenant ────────────────────────────────────────────────────────────────────
create table if not exists tenants (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  industry     text not null default 'custom',
  config       jsonb default '{}',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ── Taxonomy: Category → Topic → Action ──────────────────────────────────────
create table if not exists action_categories (
  id           uuid primary key default uuid_generate_v4(),
  tenant_id    uuid references tenants(id) on delete cascade,
  name         text not null,
  description  text,
  color        text not null default '#1D4ED8',
  created_at   timestamptz default now()
);

create table if not exists action_topics (
  id           uuid primary key default uuid_generate_v4(),
  tenant_id    uuid references tenants(id) on delete cascade,
  category_id  uuid references action_categories(id) on delete cascade,
  name         text not null,
  description  text,
  created_at   timestamptz default now()
);

create table if not exists actions (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references tenants(id) on delete cascade,
  topic_id        uuid references action_topics(id) on delete cascade,
  category_id     uuid references action_categories(id) on delete cascade,
  name            text not null,
  description     text,
  headline        text,
  body            text,
  cta_label       text,
  offer_code      text,
  channels        text[] default '{}',
  base_propensity numeric(4,3) not null default 0.5 check (base_propensity >= 0 and base_propensity <= 1),
  expected_value  numeric(10,2),
  status          text not null default 'draft' check (status in ('active','draft','archived')),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── Channels ───────────────────────────────────────────────────────────────────
create table if not exists channels (
  id          text primary key,  -- e.g. 'email', 'paid_social'
  tenant_id   uuid references tenants(id) on delete cascade,
  name        text not null,
  type        text not null check (type in ('owned','paid')),
  icon        text,
  enabled     boolean default false,
  daily_cap   integer not null default 1,
  weekly_cap  integer not null default 5,
  latency     text not null default 'batch' check (latency in ('realtime','near_realtime','batch')),
  updated_at  timestamptz default now()
);

-- ── Audiences / Segments ───────────────────────────────────────────────────────
create table if not exists audiences (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references tenants(id) on delete cascade,
  name            text not null,
  description     text,
  rules           jsonb not null default '[]',   -- SegmentRule[]
  estimated_size  integer,
  status          text not null default 'draft' check (status in ('active','draft')),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── Engagement Policies ────────────────────────────────────────────────────────
create table if not exists contact_policies (
  id                         uuid primary key default uuid_generate_v4(),
  tenant_id                  uuid references tenants(id) on delete cascade,
  name                       text not null,
  description                text,
  max_per_day                integer not null default 2,
  max_per_week               integer not null default 5,
  max_per_month              integer not null default 15,
  fatigue_window_days        integer not null default 7,
  conversion_cooldown_days   integer not null default 30,
  requires_consent           boolean not null default true,
  consent_types              text[] default '{marketing}',
  fairness_enabled           boolean not null default false,
  fairness_threshold         numeric(4,3) default 0.85,
  fairness_attribute         text,
  channel_ids                text[] default '{}',
  suppression_rules          text[] default '{}',
  status                     text not null default 'draft' check (status in ('active','draft')),
  created_at                 timestamptz default now(),
  updated_at                 timestamptz default now()
);

-- ── Adaptive Models ────────────────────────────────────────────────────────────
create table if not exists adaptive_models (
  id                   uuid primary key default uuid_generate_v4(),
  tenant_id            uuid references tenants(id) on delete cascade,
  action_id            uuid references actions(id) on delete cascade,
  name                 text not null,
  description          text,
  model_type           text not null default 'logistic_regression',
  features             text[] default '{}',
  auc                  numeric(5,4) default 0.7,
  lift_at_decile1      numeric(5,2) default 2.0,
  trained_at           timestamptz default now(),
  predictions_today    integer default 0,
  status               text not null default 'shadow' check (status in ('live','training','shadow','retired')),
  created_at           timestamptz default now()
);

-- ── Strategies ─────────────────────────────────────────────────────────────────
create table if not exists strategies (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references tenants(id) on delete cascade,
  name            text not null,
  description     text,
  lob_id          text,
  category_id     uuid references action_categories(id) on delete set null,
  topic_id        uuid references action_topics(id) on delete set null,
  action_ids      uuid[] default '{}',
  channel_ids     text[] default '{}',
  audience_ids    uuid[] default '{}',
  policy_id       uuid references contact_policies(id) on delete set null,
  model_id        uuid references adaptive_models(id) on delete set null,
  arbitration     text not null default 'propensity' check (arbitration in ('propensity','value','weighted','random_ab')),
  priority        text not null default 'standard' check (priority in ('low','standard','high','critical')),
  start_date      date,
  end_date        date,
  status          text not null default 'draft' check (status in ('active','draft','paused','ended')),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── Decision Log (append-only audit) ─────────────────────────────────────────
create table if not exists decision_log (
  id               uuid primary key default uuid_generate_v4(),
  tenant_id        uuid references tenants(id) on delete cascade,
  customer_id      text not null,
  strategy_id      uuid references strategies(id) on delete set null,
  strategy_name    text,
  action_id        uuid references actions(id) on delete set null,
  action_name      text,
  channel_id       text,
  served           boolean not null,
  suppression_reason text,
  propensity       numeric(5,4),
  outcome          text check (outcome in ('accepted','rejected','ignored', null)),
  customer_attributes jsonb default '{}',
  trace            jsonb default '[]',       -- full PolicyTrace[] for compliance
  created_at       timestamptz default now()  -- immutable — no updated_at
);

-- Decision log is append-only: block UPDATE and DELETE
create or replace rule decision_log_no_update as on update to decision_log do instead nothing;
create or replace rule decision_log_no_delete as on delete to decision_log do instead nothing;

-- ── Contact frequency counters (for fatigue enforcement) ─────────────────────
create table if not exists contact_counts (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid references tenants(id) on delete cascade,
  customer_id   text not null,
  channel_id    text,
  date          date not null default current_date,
  week_start    date not null default date_trunc('week', current_date)::date,
  month_start   date not null default date_trunc('month', current_date)::date,
  count_today   integer not null default 0,
  count_week    integer not null default 0,
  count_month   integer not null default 0,
  unique(tenant_id, customer_id, channel_id, date)
);

-- ── D&I fairness counters (per container/strategy) ────────────────────────────
create table if not exists di_counters (
  tenant_id    uuid references tenants(id) on delete cascade,
  strategy_id  uuid references strategies(id) on delete cascade,
  total        integer not null default 0,
  cohort       integer not null default 0,
  updated_at   timestamptz default now(),
  primary key (tenant_id, strategy_id)
);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Enable RLS on all tables — each tenant only sees their own data
alter table tenants           enable row level security;
alter table action_categories enable row level security;
alter table action_topics     enable row level security;
alter table actions           enable row level security;
alter table channels          enable row level security;
alter table audiences         enable row level security;
alter table contact_policies  enable row level security;
alter table adaptive_models   enable row level security;
alter table strategies        enable row level security;
alter table decision_log      enable row level security;
alter table contact_counts    enable row level security;
alter table di_counters       enable row level security;

-- ── Indexes ────────────────────────────────────────────────────────────────────
create index if not exists idx_decision_log_customer   on decision_log(tenant_id, customer_id);
create index if not exists idx_decision_log_strategy   on decision_log(tenant_id, strategy_id);
create index if not exists idx_decision_log_created_at on decision_log(created_at desc);
create index if not exists idx_contact_counts_lookup   on contact_counts(tenant_id, customer_id, date);
create index if not exists idx_strategies_status       on strategies(tenant_id, status);
create index if not exists idx_actions_status          on actions(tenant_id, status);

-- ── Helper: get contact counts for a customer ─────────────────────────────────
create or replace function get_contact_counts(
  p_tenant_id uuid,
  p_customer_id text,
  p_channel_id text default null
) returns table (
  count_today  integer,
  count_week   integer,
  count_month  integer
) language sql security definer as $$
  select
    coalesce(sum(count_today),0)::integer,
    coalesce(sum(count_week),0)::integer,
    coalesce(sum(count_month),0)::integer
  from contact_counts
  where tenant_id = p_tenant_id
    and customer_id = p_customer_id
    and (p_channel_id is null or channel_id = p_channel_id)
    and date = current_date;
$$;

-- ── Helper: increment contact count ──────────────────────────────────────────
create or replace function increment_contact_count(
  p_tenant_id uuid,
  p_customer_id text,
  p_channel_id text
) returns void language sql security definer as $$
  insert into contact_counts (tenant_id, customer_id, channel_id, date, week_start, month_start, count_today, count_week, count_month)
  values (
    p_tenant_id, p_customer_id, p_channel_id,
    current_date,
    date_trunc('week', current_date)::date,
    date_trunc('month', current_date)::date,
    1, 1, 1
  )
  on conflict (tenant_id, customer_id, channel_id, date)
  do update set
    count_today = contact_counts.count_today + 1,
    count_week  = contact_counts.count_week  + 1,
    count_month = contact_counts.count_month + 1;
$$;
