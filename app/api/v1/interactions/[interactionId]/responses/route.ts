/**
 * POST /api/v1/interactions/{interactionId}/responses
 *
 * Pega CDH Capture Response API — NexusCDH compatible.
 *
 * Records channel responses (Clicked, Accepted, Dismissed, etc.) and
 * automatically triggers adaptive model feedback via the shared learning utility.
 *
 * Body:
 *   {
 *     "responses": [
 *       {
 *         "pyName": "HomeInsuranceUpsell",
 *         "pyOutcome": "Clicked",
 *         "pyChannel": "web",
 *         "CustomerID": "cust-001",
 *         "decisionId": "uuid",      // optional — looked up if omitted
 *         "tenantId": "..."           // NexusCDH extension
 *       }
 *     ]
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { serviceSupabase } from '@/lib/supabase';
import { applyFeedback } from '@/lib/learning';

const TENANT = process.env.NEXUS_TENANT_ID ?? 'f0000000-0000-4000-a000-000000000001';

// Pega pyOutcome → NexusCDH outcome
const OUTCOME_MAP: Record<string, 'accepted' | 'rejected' | 'ignored'> = {
  Clicked:    'accepted',
  Accepted:   'accepted',
  Converted:  'accepted',
  Purchased:  'accepted',
  Applied:    'accepted',
  Dismissed:  'rejected',
  Rejected:   'rejected',
  OptedOut:   'rejected',
  Impressed:  'ignored',
  Viewed:     'ignored',
  Opened:     'ignored',
};

interface PegaResponse {
  rank?: number;
  pyName?: string;
  pyOutcome: string;
  pyChannel?: string;
  pyDirection?: string;
  pxInteractionID?: string;
  CustomerID?: string;
  customerId?: string;
  decisionId?: string;
  tenantId?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { interactionId: string } }
) {
  const interactionId = params.interactionId;

  let body: { responses?: PegaResponse[] } = {};
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const responses = body.responses ?? [];
  if (!responses.length)
    return NextResponse.json({ error: 'responses array is required' }, { status: 400 });

  if (!serviceSupabase)
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const results: Array<{
    pyName: string; pyOutcome: string; nexusOutcome: string;
    status: string; decisionId?: string;
    propensityUpdate?: { before: number; after: number; delta: number } | null;
    error?: string;
  }> = [];

  for (const r of responses) {
    const tenantId     = r.tenantId ?? TENANT;
    const customerId   = r.CustomerID ?? r.customerId ?? '';
    const pegaOutcome  = r.pyOutcome ?? '';
    const nexusOutcome = OUTCOME_MAP[pegaOutcome] ?? 'ignored';
    const actionName   = r.pyName ?? '';
    const channel      = r.pyChannel ?? 'unknown';

    try {
      let decisionId = r.decisionId;

      if (!decisionId) {
        // Look up most recent unresolved decision for this customer + action
        const { data: logRows } = await serviceSupabase
          .from('decision_log')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('customer_id', customerId)
          .eq('action_name', actionName)
          .is('outcome', null)
          .order('created_at', { ascending: false })
          .limit(1);
        decisionId = logRows?.[0]?.id;
      }

      if (decisionId) {
        // Record outcome on decision log
        await serviceSupabase
          .from('decision_log')
          .update({ outcome: nexusOutcome })
          .eq('id', decisionId);

        // Apply propensity update via shared learning utility (same rate as /api/outcome)
        const learning = await applyFeedback({
          decisionId, outcome: nexusOutcome, tenantId, channel,
        });

        results.push({
          pyName: actionName, pyOutcome: pegaOutcome, nexusOutcome,
          status: 'recorded', decisionId,
          propensityUpdate: learning ? { before: learning.before, after: learning.after, delta: learning.delta } : null,
        });
      } else {
        results.push({ pyName: actionName, pyOutcome: pegaOutcome, nexusOutcome, status: 'no_match' });
      }
    } catch (e) {
      results.push({
        pyName: actionName, pyOutcome: pegaOutcome, nexusOutcome,
        status: 'error', error: e instanceof Error ? e.message : 'unknown',
      });
    }
  }

  return NextResponse.json({
    pxInteractionID: interactionId,
    recorded:        results.filter(r => r.status === 'recorded').length,
    total:           results.length,
    results,
    pxResponseDT:    new Date().toISOString(),
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { interactionId: string } }
) {
  if (!serviceSupabase)
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const { data } = await serviceSupabase
    .from('decision_log')
    .select('id, customer_id, action_name, channel_id, served, outcome, propensity, created_at')
    .eq('experiment_id', params.interactionId)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    pxInteractionID: params.interactionId,
    decisions: data ?? [],
  });
}
