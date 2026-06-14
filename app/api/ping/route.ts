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
    const { error } = await client.from('customer_profiles').select('customer_id').limit(1);
    info.db_test = error ? `error: ${error.message}` : 'ok';
  } catch (e: unknown) {
    info.db_test = `exception: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json(info);
}
