import { prisma } from "@/app/lib/db";
import bcrypt from "bcrypt";

/**
 * POST /api/onboarding/create
 * Creates a new user account with email/password login.
 *
 * Logic:
 * 1. Validates the required account fields.
 * 2. Stores a bcrypt hash of the submitted password.
 * 3. Initializes default settings.
 * 4. Creates initial "Hi" conversation.
 *
 * Services: Prisma, bcrypt
 */
export async function POST(req: Request) {
  try {
    const data = await req.json();
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    const password = typeof data.password === 'string' ? data.password.trim() : '';
    const username = typeof data.username === 'string' ? data.username.trim() : '';
    const aiName = typeof data.aiName === 'string' && data.aiName.trim()
      ? data.aiName.trim()
      : 'Lumi';

    if (!username) {
      return Response.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Valid email is required' }, { status: 400 });
    }

    if (password.length < 8) {
      return Response.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return Response.json(
        { error: 'This email is already registered. Please log in instead.' },
        { status: 409 }
      );
    }

    const nickname = typeof data.nickname === 'string' && data.nickname.trim()
      ? data.nickname.trim()
      : username;
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        username,
        nickname,
        email,
        password: passwordHash,
        age: typeof data.age === 'number' ? data.age : null,
        ageGroup: data.ageGroup || 'adult',
        language: data.language || 'en',
        aiName,
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
