'use client';

import { createBrowserClient } from '@supabase/ssr';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const AUTH_AVAILABLE = Boolean(URL && KEY);

/** Browser Supabase client for OAuth sign-in and reading the client session. */
export function createClient() {
  return createBrowserClient(URL, KEY);
}
