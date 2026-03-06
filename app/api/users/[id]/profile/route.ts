import { prisma } from "@/app/lib/db";

/**
 * PATCH /api/users/[id]/profile
 * Updates the raw JSON profile blob (Interests, Hobbies, etc).
 *
 * Services: Prisma
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { profile } = await req.json();

  await prisma.user.update({
    where: { id },
    data: { profile: JSON.stringify(profile) },
  });

  return Response.json({ ok: true });
}
