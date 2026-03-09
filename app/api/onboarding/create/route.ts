import { prisma } from "@/app/lib/db";

/**
 * POST /api/onboarding/create
 * Creates a new user account after successful OTP verification.
 *
 * Logic:
 * 1. Validates unique email.
 * 2. Creates User record with profile data (Prisma).
 * 3. Initializes default settings (Language, Age Group).
 * 4. Creates initial "Hi" conversation.
 *
 * Services: Prisma
 */
export async function POST(req: Request) {
  try {
    const data = await req.json();

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return Response.json(
        { error: 'This email is already registered. Please log in instead.' },
        { status: 409 }
      );
    }

    const nickname = data.nickname || data.username;

    const user = await prisma.user.create({
      data: {
        username: data.username,
        nickname,
        email: data.email,
        age: data.age ?? null,
        ageGroup: data.ageGroup || 'adult',
        language: data.language || 'en',
        aiName: data.aiName || 'Lumi',
        profile: data.interests
          ? JSON.stringify({ interests: data.interests })
          : undefined,
      },
    });

    // Auto-create first conversation
    await prisma.conversation.create({
      data: {
        title: `Hi ${nickname}`,
        userId: user.id,
      },
    });

    return Response.json({ id: user.id });
  } catch (error) {
    console.error('Onboarding create error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: msg }, { status: 500 });
  }
}
