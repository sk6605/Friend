import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { deleteFromR2 } from '@/app/lib/r2';

/**
 * GET /api/users/[id]/files
 * List all uploaded files for a user.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;

  try {
    const files = await prisma.userFile.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        url: true,
        size: true,
        type: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ files });
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
  }
}

/**
 * DELETE /api/users/[id]/files?fileId=xxx
 * Delete a specific file from R2 and database.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;
  const fileId = req.nextUrl.searchParams.get('fileId');

  if (!fileId) {
    return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
  }

  try {
    const file = await prisma.userFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    if (file.userId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Delete from R2
    try {
      await deleteFromR2(file.r2Key);
    } catch (err) {
      console.warn('Failed to delete from R2:', err);
    }

    // Delete from database
    await prisma.userFile.delete({ where: { id: fileId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
