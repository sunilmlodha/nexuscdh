/**
 * /api/taxonomy — persistence for the taxonomy tree (categories, topics, actions).
 *
 * The UI used to mutate only the Zustand store, so edits never reached the DB and
 * vanished (or "reappeared", for deletes) on the next hydrate. This route writes
 * through to Postgres.
 *
 * POST   { kind, id?, ...fields }  — create (DB-generated UUID) or update; returns
 *                                     the saved row mapped to the store shape.
 * DELETE ?kind=&id=                — delete, cascading category→topics→actions and
 *                                     topic→actions.
 */
import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-guard';

type Kind = 'category' | 'topic' | 'action';
const TABLE: Record<Kind, string> = {
  category: 'action_categories',
  topic: 'action_topics',
  action: 'actions',
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// store shape → DB columns
function toRecord(kind: Kind, b: Record<string, unknown>, tenantId: string): Record<string, unknown> {
  if (kind === 'category') {
    return { tenant_id: tenantId, name: b.name, description: b.description ?? '', color: b.color ?? '#1D4ED8' };
  }
  if (kind === 'topic') {
    return { tenant_id: tenantId, name: b.name, description: b.description ?? '', category_id: b.categoryId };
  }
  return {
    tenant_id: tenantId, name: b.name, description: b.description ?? '',
    topic_id: b.topicId, category_id: b.categoryId || null,
    headline: b.headline ?? '', body: b.body ?? '', cta_label: b.ctaLabel ?? '',
    offer_code: b.offerCode ?? '', channels: b.channels ?? [],
    base_propensity: typeof b.basePropensity === 'number' ? b.basePropensity : 0.5,
    expected_value: typeof b.value === 'number' ? b.value : null,
    status: b.status ?? 'draft',
  };
}

// DB row → store shape (mirrors /api/hydrate)
function toStore(kind: Kind, r: Record<string, any>) {
  if (kind === 'category') return { id: r.id, name: r.name, description: r.description ?? '', color: r.color ?? '#1D4ED8', createdAt: r.created_at };
  if (kind === 'topic')    return { id: r.id, categoryId: r.category_id, name: r.name, description: r.description ?? '', createdAt: r.created_at };
  return {
    id: r.id, topicId: r.topic_id, categoryId: r.category_id, name: r.name, description: r.description ?? '',
    channels: r.channels ?? [], basePropensity: r.base_propensity ?? 0.5, headline: r.headline ?? '',
    body: r.body ?? '', ctaLabel: r.cta_label ?? '', offerCode: r.offer_code ?? '', value: r.expected_value ?? 0,
    status: r.status ?? 'active', createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const guard = await requireAuth('taxonomy:write');
  if (!guard.ok) return guard.res;
  const tenantId = guard.ctx.tenantId;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const kind = body.kind as Kind;
  if (!TABLE[kind]) return NextResponse.json({ error: 'invalid kind' }, { status: 422 });
  if (!String(body.name ?? '').trim()) return NextResponse.json({ error: 'name required' }, { status: 422 });

  const record = toRecord(kind, body, tenantId);
  const id = body.id;
  const isUpdate = typeof id === 'string' && UUID_RE.test(id);

  const q = isUpdate
    ? serviceSupabase!.from(TABLE[kind]).update(record).eq('tenant_id', tenantId).eq('id', id).select().single()
    : serviceSupabase!.from(TABLE[kind]).insert(record).select().single();

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: toStore(kind, data) });
}

export async function DELETE(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const guard = await requireAuth('taxonomy:write');
  if (!guard.ok) return guard.res;
  const tenantId = guard.ctx.tenantId;

  const kind = req.nextUrl.searchParams.get('kind') as Kind;
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!TABLE[kind]) return NextResponse.json({ error: 'invalid kind' }, { status: 422 });
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'valid id required' }, { status: 422 });

  const db = serviceSupabase!;
  // cascade: category → its topics + actions; topic → its actions
  if (kind === 'category') {
    await db.from('actions').delete().eq('tenant_id', tenantId).eq('category_id', id);
    await db.from('action_topics').delete().eq('tenant_id', tenantId).eq('category_id', id);
  } else if (kind === 'topic') {
    await db.from('actions').delete().eq('tenant_id', tenantId).eq('topic_id', id);
  }
  const { error } = await db.from(TABLE[kind]).delete().eq('tenant_id', tenantId).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
