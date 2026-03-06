import { prisma } from '@/app/lib/db';
import { sendOtpEmail } from '@/app/lib/email';
import * as crypto from 'crypto';

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 3;

/**
 * POST /api/auth/send-otp
 * Generic OTP sender for registration or verification.
 *
 * Logic:
 * 1. Checks rate limits (Prisma).
 * 2. Invalidates old OTPs.
 * 3. Generates a cryptographically secure 6-digit code.
 * 4. Stores OTP in DB.
 * 5. Sends email via Nodemailer.
 *
 * Services: Prisma, Nodemailer, Crypto
 */
export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    // send-otp is used for both login and registration flows
    // No user check — allow sending OTP to any valid email

    // Rate limit: max 3 OTP requests per minute per email
    const recentOtps = await prisma.otp.count({
      where: {
        email,
        createdAt: { gt: new Date(Date.now() - RATE_LIMIT_WINDOW) },
      },
    });

    if (recentOtps >= MAX_REQUESTS_PER_WINDOW) {
      return Response.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429 }
      );
    }

    // Invalidate old OTPs
    await prisma.otp.updateMany({
      where: { email, used: false },
      data: { used: true },
    });

    // Generate cryptographically secure 6-digit OTP
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.otp.create({
      data: { email, code, expiresAt },
    });

    await sendOtpEmail(email, code);

    return Response.json({ ok: true, message: 'OTP sent' });
  } catch (error) {
    console.error('Send OTP error:', error);
    return Response.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}
