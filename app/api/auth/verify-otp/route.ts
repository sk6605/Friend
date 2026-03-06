import { prisma } from '@/app/lib/db';

const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes

/**
 * POST /api/auth/verify-otp
 * Verifies the OTP code provided by the user.
 *
 * Logic:
 * 1. Checks for brute-force attempts (Prisma).
 * 2. Finds valid, non-expired OTP matching email and code.
 * 3. Marks OTP as used.
 * 4. If mode is 'login', updates user lastLoginAt.
 *
 * Services: Prisma
 */
export async function POST(req: Request) {
  try {
    const { email, code, mode } = await req.json();

    if (!email || !code) {
      return Response.json(
        { error: 'Email and code are required' },
        { status: 400 }
      );
    }

    // Brute-force protection: count recent failed attempts (used OTPs that were not matched)
    const recentAttempts = await prisma.otp.count({
      where: {
        email,
        used: true,
        createdAt: { gt: new Date(Date.now() - ATTEMPT_WINDOW) },
      },
    });

    if (recentAttempts >= MAX_ATTEMPTS) {
      return Response.json(
        { error: 'Too many attempts. Please request a new code.' },
        { status: 429 }
      );
    }

    const otp = await prisma.otp.findFirst({
      where: {
        email,
        code,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      return Response.json(
        { error: 'Invalid or expired code' },
        { status: 401 }
      );
    }

    // Mark OTP as used
    await prisma.otp.update({
      where: { id: otp.id },
      data: { used: true },
    });

    // Registration mode: user doesn't exist yet, just validate the OTP
    if (mode === 'registration') {
      return Response.json({ ok: true });
    }

    // Login mode: get the user and update last login time
    const user = await prisma.user.update({
      where: { email },
      data: { lastLoginAt: new Date() },
    });

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    return Response.json({ ok: true, userId: user.id });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return Response.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
