import { prisma } from '@/app/lib/db';
import { sendOtpEmail, isSmtpConfigured } from '@/app/lib/email';

/**
 * POST /api/auth/login
 * Handles user login for existing accounts via passwordless OTP.
 *
 * Logic:
 * 1. Validates that the email exists in the database.
 * 2. Generates a 6-digit OTP.
 * 3. Stores the OTP in the database (Prisma `Otp` model).
 * 4. Sends the OTP via email using Nodemailer.
 *
 * Services: Prisma (DB), Nodemailer (Email)
 */
export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return Response.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return Response.json(
        { error: 'No account found with this email' },
        { status: 404 }
      );
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Invalidate old OTPs for this email
    await prisma.otp.updateMany({
      where: { email, used: false },
      data: { used: true },
    });

    // Create new OTP
    await prisma.otp.create({
      data: { email, code, expiresAt },
    });

    // Send OTP email (or log to console in dev)
    await sendOtpEmail(email, code);

    const response: Record<string, unknown> = {
      ok: true,
      message: 'OTP sent to your email',
      userId: user.id,
    };

    // Dev mode: include OTP in response when SMTP is not configured
    if (!isSmtpConfigured()) {
      response.devOtp = code;
    }

    return Response.json(response);
  } catch (error) {
    console.error('Login error:', error);
    return Response.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
