import { NextRequest } from 'next/server';
import { runGrowthCheck } from '@/app/lib/cron/runGrowthCheck';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const key = req.nextUrl.searchParams.get('key');
  if (cronSecret && key !== cronSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runGrowthCheck();
    return Response.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Growth check cron error:', error);
    return Response.json({ error: 'Growth check failed' }, { status: 500 });
  }
}
