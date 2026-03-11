import { NextRequest, NextResponse } from 'next/server';
import { runDailyAnalysis } from '@/app/lib/cron/runDailyAnalysis';

/**
 * Manual trigger for daily analysis.
 * POST /api/admin/trigger-analysis
 * Auth: ADMIN_SECRET in query param or x-admin-key header.
 */
export async function POST(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET;
  const key =
    req.nextUrl.searchParams.get('key') || req.headers.get('x-admin-key');
  if (adminSecret && key !== adminSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runDailyAnalysis();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Manual analysis trigger error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Analysis trigger failed: ${msg}` },
      { status: 500 }
    );
  }
}
