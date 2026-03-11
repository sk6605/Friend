import { NextRequest, NextResponse } from 'next/server';
import { runDailyAnalysis } from '@/app/lib/cron/runDailyAnalysis';

export async function GET(req: NextRequest) {
    const cronSecret = process.env.CRON_SECRET;
    const key = req.nextUrl.searchParams.get('key');
    if (cronSecret && key !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await runDailyAnalysis();
        return NextResponse.json(result);
    } catch (error) {
        console.error('Daily analysis cron error:', error);
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: `Daily analysis failed: ${msg}` },
            { status: 500 }
        );
    }
}
