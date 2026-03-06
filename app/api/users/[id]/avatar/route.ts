import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/db';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

/**
 * POST /api/users/[id]/avatar
 * Uploads a new profile picture.
 *
 * Logic:
 * 1. Validates file type (Image) and size (Max 5MB).
 * 2. Deletes old avatar if exists.
 * 3. Saves new file to `public/uploads/avatars`.
 * 4. Updates User record.
 *
 * Services: Prisma, FileSystem
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

    // Delete old avatar if it exists
    if (user.profilePicture) {
      const oldPath = path.join(process.cwd(), 'public', user.profilePicture);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Save new avatar
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `avatar_${userId}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/avatars/${filename}`;

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
 * Remove the user's profile picture.
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
      const oldPath = path.join(process.cwd(), 'public', user.profilePicture);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
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
