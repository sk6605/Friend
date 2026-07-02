import bcrypt from 'bcrypt';
import { prisma } from '@/app/lib/db';

/**
 * PATCH /api/users/[id]/password
 * Updates a user's password after verifying the current password.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { currentPassword, newPassword } = await req.json();

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return Response.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.trim().length < 8) {
      return Response.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { password: true },
    });

    if (!user?.password) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      return Response.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword.trim(), 12);

    await prisma.user.update({
      where: { id },
      data: { password: passwordHash },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Password update error:', error);
    return Response.json({ error: 'Failed to update password' }, { status: 500 });
  }
}
