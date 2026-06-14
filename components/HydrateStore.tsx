'use client';

import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';

export default function HydrateStore() {
  const hydrateFromDB = useStore(s => s.hydrateFromDB);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    fetch('/api/hydrate')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) hydrateFromDB(data); })
      .catch(() => {});
  }, [hydrateFromDB]);

  return null;
}
