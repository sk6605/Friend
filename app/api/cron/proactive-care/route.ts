import { NextRequest } from 'next/server';
import { runProactiveCare } from '@/app/lib/cron/runProactiveCare';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const key = req.nextUrl.searchParams.get('key');
  if (cronSecret && key !== cronSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runProactiveCare();
    return Response.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Proactive care cron error:', error);
    return Response.json({ error: 'Proactive care failed' }, { status: 500 });
  }
}
