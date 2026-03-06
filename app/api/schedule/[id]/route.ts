import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/db';

// PATCH: Update schedule item (edit time/subject)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const { subject, date, endTime, userId } = body;

    // Verify ownership
    const item = await prisma.scheduleItem.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!item) return Response.json({ error: 'Not found' }, { status: 404 });
    if (item.userId !== userId) return Response.json({ error: 'Access denied' }, { status: 403 });

    const data: Record<string, unknown> = {};
    if (subject !== undefined) data.subject = subject;
    if (date !== undefined) {
      const newDate = new Date(date);
      data.date = newDate;
      // Recalculate notification time (15 min before)
      const notifyAt = new Date(newDate.getTime() - 15 * 60 * 1000);
      data.notifyAt = notifyAt > new Date() ? notifyAt : null;
      data.notified = false; // Reset notification on time change
    }
    if (endTime !== undefined) data.endTime = endTime ? new Date(endTime) : null;

    const updated = await prisma.scheduleItem.update({ where: { id }, data });
    return Response.json(updated);
  } catch (error) {
    console.error('Schedule update error:', error);
    return Response.json({ error: 'Failed to update' }, { status: 500 });
  }
}

// DELETE: Remove schedule item
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = req.nextUrl.searchParams.get('userId');

  if (!userId) return Response.json({ error: 'userId required' }, { status: 400 });

  try {
    const item = await prisma.scheduleItem.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!item) return Response.json({ error: 'Not found' }, { status: 404 });
    if (item.userId !== userId) return Response.json({ error: 'Access denied' }, { status: 403 });

    await prisma.scheduleItem.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Schedule delete error:', error);
    return Response.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
