import { prisma } from '@/app/lib/db';
import bcrypt from 'bcrypt';

const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes

/**
 * POST /api/auth/reset-password
 * Resets a forgotten password after verifying an emailed OTP.
 *
 * Two modes on the same endpoint so the UI can gate the "set new password"
 * step behind a valid code without consuming it prematurely:
 *  - verifyOnly: true  → only checks the OTP is valid AND an account exists,
 *                        WITHOUT marking the code used or touching the password.
 *  - (commit)          → re-verifies the OTP, marks it used, and stores the new
 *                        bcrypt-hashed password.
 *
 * Reuses the existing /api/auth/send-otp route to deliver the code.
 *
 * Services: Prisma (DB), bcrypt
 */
export async function POST(req: Request) {
  try {
    const { email, code, newPassword, verifyOnly } = await req.json();

    const normalizedEmail =
      typeof email === 'string' ? email.trim().toLowerCase() : '';
    const submittedCode = typeof code === 'string' ? code.trim() : '';

    if (!normalizedEmail || !submittedCode) {
      return Response.json(
        { error: 'Email and code are required' },
        { status: 400 }
      );
    }

    // Brute-force protection: too many consumed OTPs for this email recently
    const recentAttempts = await prisma.otp.count({
      where: {
        email: normalizedEmail,
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

    // Find a still-valid, unconsumed OTP matching this email + code
    const otp = await prisma.otp.findFirst({
      where: {
        email: normalizedEmail,
        code: submittedCode,
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

    // The account must exist to reset its password
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (!user) {
      return Response.json(
        { error: 'No account found for this email' },
        { status: 404 }
      );
    }

    // Peek step: confirm the code is good without consuming it
    if (verifyOnly) {
      return Response.json({ ok: true });
    }

    // Commit step: require a valid new password
    if (typeof newPassword !== 'string' || newPassword.trim().length < 8) {
      return Response.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword.trim(), 12);

    // Update the password and consume the OTP together
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: passwordHash },
      }),
      prisma.otp.update({
        where: { id: otp.id },
        data: { used: true },
      }),
    ]);

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return Response.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
