import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { updateDailyStreak } from '@/app/lib/chat/gamification';
import { prisma } from '@/app/lib/db';

// Mock the Prisma client
vi.mock('@/app/lib/db', () => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
}));

describe('gamification', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('sets streak to 1 for first time active', async () => {
        vi.setSystemTime(new Date('2023-01-01T12:00:00'));
        (prisma.user.findUnique as any).mockResolvedValue({ streak: 0, lastActiveAt: null });

        await updateDailyStreak('user-1');

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: 'user-1' },
            data: {
                streak: 1,
                lastActiveAt: new Date('2023-01-01T12:00:00')
            }
        });
    });

    it('maintains streak if active on the same day', async () => {
        vi.setSystemTime(new Date('2023-01-02T15:00:00'));
        (prisma.user.findUnique as any).mockResolvedValue({
            streak: 5,
            lastActiveAt: new Date('2023-01-02T09:00:00')
        });

        await updateDailyStreak('user-1');

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: 'user-1' },
            data: {
                streak: 5,
                lastActiveAt: new Date('2023-01-02T15:00:00')
            }
        });
    });

    it('increments streak if active the next consecutive day', async () => {
        vi.setSystemTime(new Date('2023-01-03T10:00:00'));
        (prisma.user.findUnique as any).mockResolvedValue({
            streak: 3,
            lastActiveAt: new Date('2023-01-02T18:00:00')
        });

        await updateDailyStreak('user-1');

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: 'user-1' },
            data: {
                streak: 4,
                lastActiveAt: new Date('2023-01-03T10:00:00')
            }
        });
    });

    it('resets streak to 1 if active after missing a day or more', async () => {
        vi.setSystemTime(new Date('2023-01-05T10:00:00')); // Missed Jan 4
        (prisma.user.findUnique as any).mockResolvedValue({
            streak: 10,
            lastActiveAt: new Date('2023-01-03T18:00:00')
        });

        await updateDailyStreak('user-1');

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: 'user-1' },
            data: {
                streak: 1,
                lastActiveAt: new Date('2023-01-05T10:00:00')
            }
        });
    });

    it('handles database errors gracefully without crashing', async () => {
        (prisma.user.findUnique as any).mockRejectedValue(new Error('DB connection failed'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        await expect(updateDailyStreak('user-1')).resolves.not.toThrow();
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
    });
});
