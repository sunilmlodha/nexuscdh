import { NextRequest, NextResponse } from 'next/server';
import { fetchConfigAudit, IS_CONFIGURED } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const tenantId   = req.nextUrl.searchParams.get('tenantId')   ?? 'default-tenant';
  const entityType = req.nextUrl.searchParams.get('entityType') ?? undefined;
  const limit      = parseInt(req.nextUrl.searchParams.get('limit') ?? '50');

  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });

  const data = await fetchConfigAudit(tenantId, entityType, limit);
  return NextResponse.json({ data, configured: true });
}
