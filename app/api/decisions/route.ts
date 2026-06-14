import { NextRequest, NextResponse } from 'next/server';
import { fetchDecisionLog, IS_CONFIGURED } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? 'f0000000-0000-4000-a000-000000000001';
  const limit    = parseInt(req.nextUrl.searchParams.get('limit') ?? '100');
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });
  const data = await fetchDecisionLog(tenantId, limit);
  return NextResponse.json({ data, configured: true });
}
