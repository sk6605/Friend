import { prisma } from '@/app/lib/db';
import { NextRequest } from 'next/server';

/**
 * PATCH /api/users/[id]/email
 * Updates the user's email address.
 *
 * Logic:
 * 1. Validates email format.
 * 2. Checks for uniqueness (must not be taken by another user).
 * 3. Updates User record.
 *
 * Services: Prisma
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { newEmail } = await req.json();

    if (!newEmail) {
      return Response.json(
        { error: 'New email is required' },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return Response.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if new email is already taken
    const existing = await prisma.user.findUnique({
      where: { email: newEmail },
    });
    if (existing && existing.id !== id) {
      return Response.json(
        { error: 'This email is already in use by another account' },
        { status: 409 }
      );
    }

    await prisma.user.update({
      where: { id },
      data: { email: newEmail },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Change email error:', error);
    return Response.json(
      { error: 'Failed to change email' },
      { status: 500 }
    );
  }
}
