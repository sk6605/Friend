import { prisma } from '@/app/lib/db';
import bcrypt from 'bcrypt';

const MAX_FAILED_ATTEMPTS = 5;
const FAILED_ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes

/**
 * In-memory brute-force guard for OTP guessing, keyed by email.
 *
 * Unlike a DB count of *consumed* OTPs, this tracks *failed* code guesses —
 * a wrong 6-digit code never marks anything used, so without this an attacker
 * (especially via the non-consuming `verifyOnly` peek) could brute-force the
 * ~900k code space within the 5-minute validity window and take over an
 * account. Same single-instance tradeoff as the chat route's rate limiter.
 */
const failedResetAttempts = new Map<string, { count: number; resetAt: number }>();

function isLockedOut(email: string): boolean {
  const entry = failedResetAttempts.get(email);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    failedResetAttempts.delete(email);
    return false;
  }
  return entry.count >= MAX_FAILED_ATTEMPTS;
}

function recordFailedAttempt(email: string) {
  const now = Date.now();
  const entry = failedResetAttempts.get(email);
  if (!entry || now > entry.resetAt) {
    failedResetAttempts.set(email, { count: 1, resetAt: now + FAILED_ATTEMPT_WINDOW });
  } else {
    entry.count += 1;
  }
  // Opportunistic cleanup of expired windows to bound map growth
  for (const [key, val] of failedResetAttempts) {
    if (now > val.resetAt) failedResetAttempts.delete(key);
  }
}

function clearFailedAttempts(email: string) {
  failedResetAttempts.delete(email);
}

/**
 * POST /api/auth/reset-password
 * Resets a forgotten password in a single, state-changing call.
 *
 * Body: { email, code, newPassword }. The emailed OTP is verified and consumed
 * here and only here — there is deliberately no "verify without consuming" mode,
 * since a non-consuming peek is a free brute-force oracle. The UI collects the
 * code and new password client-side and submits them together; a wrong code
 * fails this call and counts against the per-account failed-attempt limiter.
 *
 * Reuses the existing /api/auth/send-otp route to deliver the code.
 *
 * Services: Prisma (DB), bcrypt
 */
export async function POST(req: Request) {
  try {
    const { email, code, newPassword } = await req.json();

    const normalizedEmail =
      typeof email === 'string' ? email.trim().toLowerCase() : '';
    const submittedCode = typeof code === 'string' ? code.trim() : '';

    if (!normalizedEmail || !submittedCode) {
      return Response.json(
        { error: 'Email and code are required' },
        { status: 400 }
      );
    }

    // Brute-force guard: too many FAILED guesses for this email recently.
    // Once locked, kill any live OTPs so guessing requires a fresh send-otp
    // (itself IP/email rate-limited) rather than the same code space.
    if (isLockedOut(normalizedEmail)) {
      await prisma.otp.updateMany({
        where: { email: normalizedEmail, used: false },
        data: { used: true },
      });
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
      // Wrong / expired code — count it as a failed guess
      recordFailedAttempt(normalizedEmail);
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

    // Require a valid new password. Validate BEFORE consuming the OTP so a
    // too-short password lets the user retry with the same still-valid code.
    if (typeof newPassword !== 'string' || newPassword.trim().length < 8) {
      return Response.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Trim to match registration + login, so the stored hash equals what the
    // user will later type at sign-in (avoids self-lockout on padded input).
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

    clearFailedAttempts(normalizedEmail);
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return Response.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
