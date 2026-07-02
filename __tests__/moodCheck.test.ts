// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getLocalDateKey,
  getMoodCheckStorageKey,
  hasMoodCheckToday,
  markMoodCheckToday,
  shouldCreateDailyMoodCheck,
} from '@/app/lib/moodCheck';

describe('daily mood check', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('uses a local YYYY-MM-DD date key', () => {
    vi.setSystemTime(new Date('2026-07-01T14:30:00'));

    expect(getLocalDateKey()).toBe('2026-07-01');
  });

  it('tracks the mood prompt once per user per day', () => {
    vi.setSystemTime(new Date('2026-07-01T08:00:00'));

    expect(hasMoodCheckToday('user-1')).toBe(false);
    markMoodCheckToday('user-1');

    expect(localStorage.getItem(getMoodCheckStorageKey('user-1'))).toBe('2026-07-01');
    expect(hasMoodCheckToday('user-1')).toBe(true);
    expect(hasMoodCheckToday('user-2')).toBe(false);
  });

  it('allows a new prompt on the next local day', () => {
    vi.setSystemTime(new Date('2026-07-01T08:00:00'));
    markMoodCheckToday('user-1');

    vi.setSystemTime(new Date('2026-07-02T08:00:00'));

    expect(hasMoodCheckToday('user-1')).toBe(false);
  });

  it('only creates an automatic mood conversation when the last message is old and today has not been checked', () => {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));

    expect(shouldCreateDailyMoodCheck({
      userId: 'user-1',
      lastMessageCreatedAt: '2026-07-01T09:30:00',
    })).toBe(true);

    markMoodCheckToday('user-1');

    expect(shouldCreateDailyMoodCheck({
      userId: 'user-1',
      lastMessageCreatedAt: '2026-07-01T09:30:00',
    })).toBe(false);

    expect(shouldCreateDailyMoodCheck({
      userId: 'user-2',
      lastMessageCreatedAt: '2026-07-01T11:00:00',
    })).toBe(false);
  });
});
