import { prisma } from '@/app/lib/db';

/**
 * Activate SAFE_MODE for a user.
 * Sets user.safeMode = true and creates an audit log entry.
 */
export async function activateSafeMode(
  userId: string,
  crisisEventId: string,
  reason: string,
): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        safeMode: true,
        safeModeAt: new Date(),
      },
    }),
    prisma.safeModeLog.create({
      data: {
        userId,
        crisisEventId,
        action: 'activated',
        reason,
        performedBy: 'system',
      },
    }),
  ]);
}

/**
 * Deactivate SAFE_MODE for a user.
 * Sets user.safeMode = false and creates an audit log entry.
 */
export async function deactivateSafeMode(
  userId: string,
  performedBy: string,
  reason: string,
): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        safeMode: false,
        safeModeAt: null,
      },
    }),
    prisma.safeModeLog.create({
      data: {
        userId,
        action: 'deactivated',
        reason,
        performedBy,
      },
    }),
  ]);
}

/**
 * Record a crisis event in the database.
 * Returns the created event ID.
 */
export async function recordCrisisEvent(
  userId: string,
  messageId: string | null,
  conversationId: string,
  riskLevel: number,
  triggerContent: string,
  classificationReason: string,
  keywords: string[],
): Promise<string> {
  const event = await prisma.crisisEvent.create({
    data: {
      userId,
      messageId,
      conversationId,
      riskLevel,
      triggerContent,
      classificationReason,
      keywords: JSON.stringify(keywords),
      status: riskLevel >= 2 ? 'open' : 'acknowledged',
    },
  });
  return event.id;
}
