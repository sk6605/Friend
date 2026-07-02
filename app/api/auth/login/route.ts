import { prisma } from '@/app/lib/db';
import bcrypt from 'bcrypt';

/**
 * POST /api/auth/login
 * Handles user login for existing accounts via email and password.
 *
 * Logic:
 * 1. Normalizes and validates email/password input.
 * 2. Loads the matching user by email.
 * 3. Verifies the submitted password against the stored bcrypt hash.
 *
 * Services: Prisma (DB), bcrypt
 */
export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const submittedPassword = typeof password === 'string' ? password : '';

    if (!normalizedEmail || !submittedPassword) {
      return Response.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user?.password) {
      return Response.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const passwordMatches = await bcrypt.compare(submittedPassword, user.password);
    if (!passwordMatches) {
      return Response.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    return Response.json({ ok: true, userId: user.id });
  } catch (error) {
    console.error('Login error:', error);
    return Response.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
