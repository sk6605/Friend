import { prisma } from '@/app/lib/db';

/**
 * Account restriction thresholds:
 * - 1st extreme speech violation (riskLevel >= 2): Warning logged
 * - 2nd violation: 24-hour temporary restriction
 * - 3rd violation: 7-day temporary restriction
 * - 4th+ violation: Permanent restriction
 */

const RESTRICTION_TIERS = [
  { minViolations: 2, durationMs: 24 * 60 * 60 * 1000, label: '24 hours' },       // 2nd offense
  { minViolations: 3, durationMs: 7 * 24 * 60 * 60 * 1000, label: '7 days' },     // 3rd offense
  { minViolations: 4, durationMs: null, label: 'permanent' },                       // 4th+ offense
];

export interface RestrictionResult {
  restricted: boolean;
  violationCount: number;
  duration: string | null; // e.g. "24 hours", "7 days", "permanent", or null (warning only)
}

/**
 * Record an extreme speech violation and apply restriction if thresholds are met.
 * Only applies to 'extreme_speech' category with riskLevel >= 2.
 */
export async function recordViolationAndRestrict(
  userId: string,
  reason: string,
): Promise<RestrictionResult> {
  // Increment violation count
  const user = await prisma.user.update({
    where: { id: userId },
    data: { violationCount: { increment: 1 } },
    select: { violationCount: true },
  });

  const count = user.violationCount;

  // Determine restriction tier
  const tier = [...RESTRICTION_TIERS].reverse().find((t) => count >= t.minViolations);

  if (!tier) {
    // Below threshold — warning only (1st violation)
    return { restricted: false, violationCount: count, duration: null };
  }

  // Apply restriction
  const now = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: {
      restricted: true,
      restrictedAt: now,
      restrictedUntil: tier.durationMs ? new Date(now.getTime() + tier.durationMs) : null,
      restrictionReason: reason,
    },
  });

  return { restricted: true, violationCount: count, duration: tier.label };
}

/**
 * Check if a user is currently restricted.
 * Automatically lifts expired temporary restrictions.
 */
export async function checkRestriction(userId: string): Promise<{
  restricted: boolean;
  restrictedUntil: Date | null;
  reason: string | null;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { restricted: true, restrictedUntil: true, restrictionReason: true },
  });

  if (!user || !user.restricted) {
    return { restricted: false, restrictedUntil: null, reason: null };
  }

  // Check if temporary restriction has expired
  if (user.restrictedUntil && user.restrictedUntil <= new Date()) {
    await prisma.user.update({
      where: { id: userId },
      data: { restricted: false, restrictedAt: null, restrictedUntil: null, restrictionReason: null },
    });
    return { restricted: false, restrictedUntil: null, reason: null };
  }

  return {
    restricted: true,
    restrictedUntil: user.restrictedUntil,
    reason: user.restrictionReason,
  };
}

/**
 * Admin: lift a user's restriction manually.
 */
export async function liftRestriction(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      restricted: false,
      restrictedAt: null,
      restrictedUntil: null,
      restrictionReason: null,
    },
  });
}
