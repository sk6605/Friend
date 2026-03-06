import { NextRequest } from 'next/server';
import { runDailySummary } from '@/app/lib/cron/runDailySummary';

/**
 * GET /api/cron/daily-summary
 * Manually trigger the daily summary (also runs automatically at 12:00 PM via instrumentation.ts).
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const key = req.nextUrl.searchParams.get('key');
  if (cronSecret && key !== cronSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runDailySummary();
    return Response.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Daily summary cron error:', error);
    return Response.json({ error: 'Daily summary failed' }, { status: 500 });
  }
}
