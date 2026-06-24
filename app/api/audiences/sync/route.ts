/**
 * POST /api/audiences/sync
 *
 * Paid media audience sync stubs.
 * Exports a Stratcheck audience segment to Meta, Google, or LinkedIn.
 *
 * Body: { audienceId, platform, tenantId? }
 *
 * Returns a job receipt. Real connector credentials would be stored in
 * Settings → Integrations and used here to call platform APIs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, supabase, serviceSupabase } from '@/lib/supabase';

type Platform = 'meta' | 'google' | 'linkedin' | 'tiktok' | 'programmatic';

const PLATFORM_META: Record<Platform, { label: string; endpoint: string }> = {
  meta:          { label: 'Meta Ads (Facebook/Instagram)', endpoint: 'https://graph.facebook.com/v19.0/act_<AD_ACCOUNT_ID>/customaudiences' },
  google:        { label: 'Google Ads Customer Match',     endpoint: 'https://googleads.googleapis.com/v16/customers/<CID>/offlineUserDataJobs' },
  linkedin:      { label: 'LinkedIn Matched Audiences',    endpoint: 'https://api.linkedin.com/v2/dmpSegments' },
  tiktok:        { label: 'TikTok Audience',               endpoint: 'https://business-api.tiktok.com/open_api/v1.3/dmp/custom_audience/create/' },
  programmatic:  { label: 'Programmatic DSP (LiveRamp)',   endpoint: 'https://connect.liveramp.com/api/v1/segments' },
};

export async function POST(req: NextRequest) {
  let body: { audienceId: string; platform: Platform; tenantId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { audienceId, platform, tenantId = 'f0000000-0000-4000-a000-000000000001' } = body;
  if (!audienceId || !platform) {
    return NextResponse.json({ error: 'audienceId and platform required' }, { status: 400 });
  }
  if (!PLATFORM_META[platform]) {
    return NextResponse.json({ error: `Unknown platform. Supported: ${Object.keys(PLATFORM_META).join(', ')}` }, { status: 400 });
  }

  // Fetch audience profile count (real data when Supabase is configured)
  let profileCount = 0;
  if (IS_CONFIGURED) {
    const { count } = await serviceSupabase!
      .from('customer_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    profileCount = count ?? 0;
  }

  const meta = PLATFORM_META[platform];
  const jobId = `sync_${platform}_${audienceId.slice(0, 8)}_${Date.now().toString(36)}`;

  // In production: authenticate with platform SDK, hash PII (SHA-256 email/phone),
  // batch-upload in chunks of 10k, poll for completion.
  // For now: return a well-structured job receipt that downstream code can act on.

  return NextResponse.json({
    jobId,
    status:       'queued',
    platform,
    platformLabel: meta.label,
    audienceId,
    profileCount,
    estimatedProfiles: profileCount,
    targetEndpoint: meta.endpoint,
    piiHashing:    'SHA-256 (email + phone)',
    note:          'Connect platform credentials in Settings → Integrations to enable live sync.',
    queuedAt:      new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) {
  // List sync history for an audience (stub — returns shape for UI to render)
  const audienceId = req.nextUrl.searchParams.get('audienceId') ?? '';
  if (!audienceId) return NextResponse.json({ error: 'audienceId required' }, { status: 400 });
  return NextResponse.json({ data: [], audienceId, note: 'Sync history requires platform connector credentials.' });
}
