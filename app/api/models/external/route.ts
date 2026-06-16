/**
 * /api/models/external
 *
 * CRUD for external model configs (Vertex AI, SageMaker, H2O, Azure ML, etc.)
 * GET    ?tenantId=  — list all configs
 * POST              — create or update (id in body = update)
 * DELETE ?id=&tenantId= — remove
 *
 * POST ?test=true   — test-score a config against the provider endpoint
 *                     Returns { success, score, latencyMs, raw }
 */

import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  if (!IS_CONFIGURED || !serviceSupabase)
    return NextResponse.json({ data: [], configured: false });

  const { data, error } = await serviceSupabase
    .from('external_model_configs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], configured: true });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED || !serviceSupabase)
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const isTest = req.nextUrl.searchParams.get('test') === 'true';
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const tenantId = (body.tenantId as string) ?? DEFAULT_TENANT;

  // ── Test mode: call the external endpoint and return the result ──────────────
  if (isTest) {
    const result = await testExternalModel(body);
    if (!result.success) {
      // Persist test result if config has an id
      if (body.id && serviceSupabase) {
        await serviceSupabase.from('external_model_configs')
          .update({ last_tested_at: new Date().toISOString(), last_test_result: result, status: 'testing' })
          .eq('id', body.id).eq('tenant_id', tenantId);
      }
      return NextResponse.json(result, { status: 422 });
    }
    if (body.id) {
      await serviceSupabase.from('external_model_configs')
        .update({ last_tested_at: new Date().toISOString(), last_test_result: result })
        .eq('id', body.id).eq('tenant_id', tenantId);
    }
    return NextResponse.json(result);
  }

  // ── Create / Update ───────────────────────────────────────────────────────────
  const payload = {
    tenant_id:    tenantId,
    name:         body.name,
    description:  body.description ?? '',
    provider:     body.provider,
    endpoint_url: body.endpoint_url ?? '',
    api_key:      body.api_key ?? '',
    model_id:     body.model_id ?? '',
    region:       body.region ?? '',
    project_id:   body.project_id ?? '',
    feature_map:  body.feature_map ?? {},
    output_field: body.output_field ?? 'score',
    status:       body.status ?? 'inactive',
    action_id:    body.action_id ?? null,
    updated_at:   new Date().toISOString(),
  };

  if (body.id) {
    const { data, error } = await serviceSupabase
      .from('external_model_configs')
      .update(payload)
      .eq('id', body.id).eq('tenant_id', tenantId)
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  const { data, error } = await serviceSupabase
    .from('external_model_configs')
    .insert(payload)
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  if (!IS_CONFIGURED || !serviceSupabase)
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const id       = req.nextUrl.searchParams.get('id') ?? '';
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await serviceSupabase
    .from('external_model_configs')
    .delete()
    .eq('id', id).eq('tenant_id', tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// ── Provider scoring proxy ────────────────────────────────────────────────────
// Sends a test payload to the configured endpoint and extracts the score.

interface TestResult {
  success: boolean;
  score?: number;
  latencyMs?: number;
  raw?: unknown;
  error?: string;
}

async function testExternalModel(config: Record<string, unknown>): Promise<TestResult> {
  const provider    = config.provider as string;
  const endpointUrl = config.endpoint_url as string;
  const apiKey      = config.api_key as string;

  if (!endpointUrl) return { success: false, error: 'No endpoint URL configured' };

  // Build a minimal test payload per provider
  const testCustomer = { age: 35, income_band: 'medium', product_interest: 'savings', risk_score: 0.4 };
  const featureMap   = (config.feature_map as Record<string, string>) ?? {};
  const mapped: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(testCustomer)) {
    const outKey = featureMap[k] ?? k;
    mapped[outKey] = v;
  }

  const t0 = Date.now();
  try {
    let response: Response;
    if (provider === 'vertex_ai') {
      response = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ instances: [mapped] }),
        signal: AbortSignal.timeout(8000),
      });
    } else if (provider === 'sagemaker') {
      response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey ? `AWS ${apiKey}` : '',
        },
        body: JSON.stringify(mapped),
        signal: AbortSignal.timeout(8000),
      });
    } else if (provider === 'azure_ml') {
      response = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ data: [Object.values(mapped)] }),
        signal: AbortSignal.timeout(8000),
      });
    } else {
      // h2o, databricks, custom — generic Bearer auth
      response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(mapped),
        signal: AbortSignal.timeout(8000),
      });
    }

    const latencyMs = Date.now() - t0;
    const raw = await response.json().catch(() => null);
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${JSON.stringify(raw)}`, latencyMs, raw };
    }

    // Extract propensity score from response using output_field path
    const outputField = (config.output_field as string) ?? 'score';
    const score = extractScore(raw, outputField, provider);
    return { success: true, score, latencyMs, raw };
  } catch (err: unknown) {
    const latencyMs = Date.now() - t0;
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg, latencyMs };
  }
}

function extractScore(raw: unknown, field: string, provider: string): number | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  // Provider-specific extraction
  if (provider === 'vertex_ai' && Array.isArray(obj.predictions)) {
    const first = obj.predictions[0];
    return typeof first === 'number' ? first : (first as Record<string, number>)?.[field];
  }
  if (provider === 'sagemaker' && Array.isArray(obj.predictions)) {
    return (obj.predictions as number[])[0];
  }
  if (provider === 'azure_ml' && Array.isArray(obj.result)) {
    return (obj.result as number[])[0];
  }
  // Generic path — try direct field, then nested scores/outputs
  if (typeof obj[field] === 'number') return obj[field] as number;
  const nested = (obj.scores ?? obj.output ?? obj.outputs ?? obj.data) as Record<string, unknown> | undefined;
  if (nested && typeof nested[field] === 'number') return nested[field] as number;
  return undefined;
}
