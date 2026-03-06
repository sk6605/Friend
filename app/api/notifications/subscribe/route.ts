import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';

/**
 * POST /api/notifications/subscribe
 * Registers a WebPush subscription for a user.
 *
 * Logic:
 * 1. Receives PushSubscription object from client.
 * 2. Stores it in the User model (JSON stringified).
 *
 * Services: Prisma
 */
export async function POST(req: NextRequest) {
    try {
        const { userId, subscription } = await req.json();

        if (!userId || !subscription) {
            return NextResponse.json({ error: 'Missing data' }, { status: 400 });
        }

        const subString = JSON.stringify(subscription);

        await prisma.user.update({
            where: { id: userId },
            data: {
                pushSubscription: subString,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving subscription:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
