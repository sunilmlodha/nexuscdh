/**
 * POST /api/v1/interactions/{interactionId}/responses
 *
 * Pega CDH Capture Response API — NexusCDH compatible implementation.
 *
 * Records customer responses (Clicked, Accepted, Dismissed, etc.) back into
 * the decision log and triggers adaptive model feedback.
 *
 * Body:
 *   {
 *     "responses": [
 *       {
 *         "rank": 1,
 *         "pyName": "HomeInsuranceUpsell",
 *         "pyOutcome": "Clicked",       // Pega outcome enum
 *         "pyChannel": "web",
 *         "pyDirection": "Outbound",
 *         "pxInteractionID": "INT-abc",
 *         "CustomerID": "cust-001",
 *         "tenantId": "..."             // NexusCDH extension
 *       }
 *     ]
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { serviceSupabase } from '@/lib/supabase';

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
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const responses = body.responses ?? [];
  if (!responses.length) {
    return NextResponse.json({ error: 'responses array is required' }, { status: 400 });
  }

  if (!serviceSupabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const results: Array<{
    pyName: string;
    pyOutcome: string;
    nexusOutcome: string;
    status: string;
    decisionId?: string;
    error?: string;
  }> = [];

  for (const r of responses) {
    const tenantId    = r.tenantId ?? TENANT;
    const customerId  = r.CustomerID ?? r.customerId ?? '';
    const pegaOutcome = r.pyOutcome ?? '';
    const nexusOutcome = OUTCOME_MAP[pegaOutcome] ?? 'ignored';
    const actionName  = r.pyName ?? '';

    try {
      // Find the decision log entry — by explicit decisionId or by interactionId/action lookup
      let decisionId = r.decisionId;

      if (!decisionId) {
        // Look up the most recent unresolved decision for this customer+action
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
        // Update decision log outcome (no-op if rule blocks it — that's fine)
        await serviceSupabase
          .from('decision_log')
          .update({ outcome: nexusOutcome })
          .eq('id', decisionId);

        // Adaptive model feedback: nudge base_propensity
        if (nexusOutcome === 'accepted' || nexusOutcome === 'rejected') {
          const { data: logRow } = await serviceSupabase
            .from('decision_log').select('action_id, propensity')
            .eq('id', decisionId).single();

          if (logRow?.action_id) {
            const { data: action } = await serviceSupabase
              .from('actions').select('base_propensity')
              .eq('id', logRow.action_id).single();

            if (action) {
              const delta   = nexusOutcome === 'accepted' ? 0.02 : -0.01;
              const newProp = Math.max(0.01, Math.min(0.99, (action.base_propensity ?? 0.5) + delta));
              await serviceSupabase
                .from('actions')
                .update({ base_propensity: newProp, updated_at: new Date().toISOString() })
                .eq('id', logRow.action_id);
            }
          }
        }

        results.push({ pyName: actionName, pyOutcome: pegaOutcome, nexusOutcome, status: 'recorded', decisionId });
      } else {
        // No matching decision log — still accept the call (idempotent)
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

// GET — retrieve responses logged for an interaction
export async function GET(
  _req: NextRequest,
  { params }: { params: { interactionId: string } }
) {
  if (!serviceSupabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const { data } = await serviceSupabase
    .from('decision_log')
    .select('id,customer_id,action_name,channel_id,served,outcome,propensity,created_at')
    .eq('experiment_id', params.interactionId)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    pxInteractionID: params.interactionId,
    decisions: data ?? [],
  });
}
