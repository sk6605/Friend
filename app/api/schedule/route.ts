import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/db';

// GET: List schedule items for a user (optional date range filter)
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return Response.json({ error: 'userId required' }, { status: 400 });

  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');

  const where: Record<string, unknown> = { userId };
  if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    where.date = dateFilter;
  }

  try {
    const items = await prisma.scheduleItem.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    return Response.json(items);
  } catch (error) {
    console.error('Schedule list error:', error);
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}

// POST: Create a new schedule item
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, subject, date, endTime, type, source } = body;

    if (!userId || !subject || !date) {
      return Response.json({ error: 'userId, subject, and date are required' }, { status: 400 });
    }

    const eventDate = new Date(date);
    // Default: notify 15 min before
    const notifyAt = new Date(eventDate.getTime() - 15 * 60 * 1000);

    const item = await prisma.scheduleItem.create({
      data: {
        userId,
        subject,
        date: eventDate,
        endTime: endTime ? new Date(endTime) : null,
        type: type || 'event',
        source: source || 'manual',
        notifyAt: notifyAt > new Date() ? notifyAt : null,
      },
    });

    return Response.json(item);
  } catch (error) {
    console.error('Schedule create error:', error);
    return Response.json({ error: 'Failed to create schedule item' }, { status: 500 });
  }
}
