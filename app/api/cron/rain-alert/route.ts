import { NextRequest } from 'next/server';
import { runRainAlert } from '@/app/lib/cron/runRainAlert';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const key = req.nextUrl.searchParams.get('key');
  if (cronSecret && key !== cronSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runRainAlert();
    return Response.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Rain alert cron error:', error);
    return Response.json({ error: 'Rain alert check failed' }, { status: 500 });
  }
}
