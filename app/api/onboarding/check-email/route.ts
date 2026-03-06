import { prisma } from "@/app/lib/db";

/**
 * POST /api/onboarding/check-email
 * Checks if an email is already registered during onboarding.
 *
 * Logic:
 * 1. Queries the User model for the provided email.
 * 2. Returns structured JSON { exists: boolean }.
 *
 * Services: Prisma
 */
export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true },
    });

    return Response.json({ exists: !!existing });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
