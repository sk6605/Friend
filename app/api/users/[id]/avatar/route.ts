import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/db';
import * as crypto from 'crypto';
import { uploadToR2, deleteFromR2, getR2KeyFromUrl } from '@/app/lib/r2';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

/**
 * POST /api/users/[id]/avatar
 * Uploads a new profile picture to Cloudflare R2.
 *
 * Logic:
 * 1. Validates file type (Image) and size (Max 5MB).
 * 2. Deletes old avatar from R2 if exists.
 * 3. Uploads new file to R2 bucket under `avatars/` prefix.
 * 4. Updates User record with public URL.
 *
 * Services: Prisma, Cloudflare R2
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('avatar') as File | null;

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json(
        { error: 'Invalid file type. Allowed: PNG, JPG, WebP, GIF' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return Response.json({ error: 'File too large. Max 5MB.' }, { status: 400 });
    }

    // Delete old avatar from R2 if it exists
    if (user.profilePicture) {
      const oldKey = getR2KeyFromUrl(user.profilePicture);
      if (oldKey) {
        try {
          await deleteFromR2(oldKey);
        } catch (err) {
          console.warn('Failed to delete old avatar from R2:', err);
        }
      }
    }

    // Upload new avatar to R2
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const key = `avatars/avatar_${userId}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const publicUrl = await uploadToR2(key, buffer, file.type);

    // Update user record
    await prisma.user.update({
      where: { id: userId },
      data: { profilePicture: publicUrl },
    });

    return Response.json({ ok: true, url: publicUrl });
  } catch (error) {
    console.error('Avatar upload error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: `Upload failed: ${msg}` }, { status: 500 });
  }
}

/**
 * DELETE /api/users/[id]/avatar
 * Remove the user's profile picture from R2.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.profilePicture) {
      const key = getR2KeyFromUrl(user.profilePicture);
      if (key) {
        try {
          await deleteFromR2(key);
        } catch (err) {
          console.warn('Failed to delete avatar from R2:', err);
        }
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { profilePicture: null },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Avatar delete error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: `Delete failed: ${msg}` }, { status: 500 });
  }
}
