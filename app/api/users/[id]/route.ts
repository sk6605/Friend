import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/db';

/**
 * GET /api/users/[id]
 * Retrieves full user profile details.
 *
 * PATCH /api/users/[id]
 * Updates user profile fields (Language, AI Name, Data Control, etc).
 *
 * Services: Prisma
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        nickname: true,
        email: true,
        age: true,
        ageGroup: true,
        language: true,
        aiName: true,
        profilePicture: true,
        country: true,
        city: true,
        departureTime: true,
        dataControl: true,
        persona: true,
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    return Response.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    return Response.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const stringFields = ['language', 'aiName', 'country', 'city', 'departureTime', 'persona'];
    const booleanFields = ['dataControl'];
    const data: Record<string, string | boolean> = {};

    for (const key of Object.keys(body)) {
      if (stringFields.includes(key) && typeof body[key] === 'string') {
        data[key] = body[key];
      }
      if (booleanFields.includes(key) && typeof body[key] === 'boolean') {
        data[key] = body[key];
      }
    }

    if (Object.keys(data).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, language: true, aiName: true, country: true, city: true, departureTime: true, dataControl: true, persona: true },
    });

    return Response.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    return Response.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
