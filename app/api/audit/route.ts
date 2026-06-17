import { NextRequest, NextResponse } from 'next/server';
import { fetchConfigAudit, IS_CONFIGURED } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const tenantId   = req.nextUrl.searchParams.get('tenantId')   ?? 'f0000000-0000-4000-a000-000000000001';
  const entityType = req.nextUrl.searchParams.get('entityType') ?? undefined;
  const entityId   = req.nextUrl.searchParams.get('entityId')   ?? undefined;
  const limit      = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50'), 200);

  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });

  const data = await fetchConfigAudit(tenantId, entityType, limit, entityId);
  return NextResponse.json({ data, configured: true });
}
