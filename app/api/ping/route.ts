import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  const info = {
    SUPABASE_URL_SET:      url.length > 0,
    SUPABASE_URL_PREFIX:   url.slice(0, 30) || '(empty)',
    ANON_KEY_SET:          anon.length > 0,
    SERVICE_KEY_SET:       svc.length > 0,
    db_test: null as unknown,
  };

  if (!url || !anon) {
    return NextResponse.json({ ...info, error: 'env vars missing' }, { status: 500 });
  }

  try {
    const key = svc || anon;
    const client = createClient(url, key);

    // Test 1: basic connectivity with a known-safe table
    const t1 = await client.from('strategies').select('id').limit(1);
    // Test 2: customer_profiles table
    const t2 = await client.from('customer_profiles').select('customer_id').limit(1);
    // Test 3: action_categories table
    const t3 = await client.from('action_categories').select('id').limit(1);

    info.db_test = {
      strategies:        t1.error ? t1.error.message : 'ok',
      customer_profiles: t2.error ? t2.error.message : 'ok',
      action_categories: t3.error ? t3.error.message : 'ok',
    };
  } catch (e: unknown) {
    info.db_test = `exception: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json(info);
}
