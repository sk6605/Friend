import { NextRequest } from 'next/server';
import { runScheduleReminders } from '@/app/lib/cron/runScheduleReminders';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const key = req.nextUrl.searchParams.get('key');
  if (cronSecret && key !== cronSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runScheduleReminders();
    return Response.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Schedule reminder cron error:', error);
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
