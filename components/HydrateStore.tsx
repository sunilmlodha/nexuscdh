'use client';

import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import type { DecisionRecord } from '@/lib/store';

export default function HydrateStore() {
  const hydrateFromDB = useStore(s => s.hydrateFromDB);
  const setDecisions  = useStore(s => s.setDecisions);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    // Config (taxonomy, strategies, policies, audiences)
    fetch('/api/hydrate')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) hydrateFromDB(data); })
      .catch(() => {});

    // Decision log → powers "Decisions Today" + "Recent Decisions" on the dashboard
    fetch('/api/decisions?limit=500')
      .then(r => r.ok ? r.json() : null)
      .then(res => {
        const rows = res?.data;
        if (!Array.isArray(rows)) return;
        const mapped: DecisionRecord[] = rows.map((d: Record<string, unknown>) => ({
          id:                String(d.id),
          customerId:        String(d.customer_id ?? ''),
          strategyId:        String(d.strategy_id ?? ''),
          strategyName:      String(d.strategy_name ?? ''),
          actionId:          d.action_id ? String(d.action_id) : undefined,
          actionName:        d.action_name ? String(d.action_name) : undefined,
          channelId:         (d.channel_id as DecisionRecord['channelId']) ?? undefined,
          served:            Boolean(d.served),
          suppressionReason: d.suppression_reason ? String(d.suppression_reason) : undefined,
          propensity:        typeof d.propensity === 'number' ? d.propensity : undefined,
          outcome:           d.outcome as DecisionRecord['outcome'],
          timestamp:         String(d.created_at ?? ''),
        }));
        setDecisions(mapped);
      })
      .catch(() => {});
  }, [hydrateFromDB, setDecisions]);

  return null;
}
