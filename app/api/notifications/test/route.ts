import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import webpush from 'web-push';

// Initialize web-push
const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

if (publicVapidKey && privateVapidKey) {
    webpush.setVapidDetails(
        'mailto:admin@friendai.com',
        publicVapidKey,
        privateVapidKey
    );
}

/**
 * POST /api/notifications/test
 * Sends a test push notification to the user.
 *
 * Logic:
 * 1. Retrieves user's subscription from DB.
 * 2. Sends a "Hello" notification via WebPush.
 *
 * Services: Prisma, WebPush
 */
export async function POST(req: NextRequest) {
    try {
        const { userId } = await req.json();

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { pushSubscription: true, nickname: true }
        });

        if (!user || !user.pushSubscription) {
            return NextResponse.json({ error: "User not subscribed" }, { status: 404 });
        }

        const subscription = JSON.parse(user.pushSubscription);
        const payload = JSON.stringify({
            title: `Hello ${user.nickname || 'Friend'}!`,
            body: "This is a test notification from Friend AI. 🚀",
            url: "/chat"
        });

        await webpush.sendNotification(subscription, payload);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error sending notification:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
