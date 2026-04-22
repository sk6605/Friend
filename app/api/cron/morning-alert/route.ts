import { NextRequest } from 'next/server';
import { runDailyMorningAlert } from '@/app/lib/cron/runDailyMorningAlert';

// Vercel Hobby: default is 10s which is too short for AI generation + weather API.
// maxDuration allows up to 60s on Hobby plan.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
    const cronSecret = process.env.CRON_SECRET;
    const key = req.nextUrl.searchParams.get('key');
    if (cronSecret && key !== cronSecret) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await runDailyMorningAlert();
        return Response.json({ ok: true, ...result, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('Morning alert cron error:', error);
        return Response.json({ error: 'Morning alert check failed' }, { status: 500 });
    }
}
