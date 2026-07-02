const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function getStorage(): Storage | null {
  if (typeof globalThis.localStorage === 'undefined') return null;
  return globalThis.localStorage;
}

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMoodCheckStorageKey(userId: string): string {
  return `mood_checked:${userId}`;
}

export function hasMoodCheckToday(userId: string, date = new Date()): boolean {
  const storage = getStorage();
  if (!storage || !userId) return false;
  return storage.getItem(getMoodCheckStorageKey(userId)) === getLocalDateKey(date);
}

export function markMoodCheckToday(userId: string, date = new Date()): void {
  const storage = getStorage();
  if (!storage || !userId) return;
  storage.setItem(getMoodCheckStorageKey(userId), getLocalDateKey(date));
}

export function shouldCreateDailyMoodCheck({
  userId,
  lastMessageCreatedAt,
  now = new Date(),
}: {
  userId: string;
  lastMessageCreatedAt?: string | Date | null;
  now?: Date;
}): boolean {
  if (!lastMessageCreatedAt || hasMoodCheckToday(userId, now)) return false;

  const lastMessageTime = new Date(lastMessageCreatedAt).getTime();
  if (Number.isNaN(lastMessageTime)) return false;

  return now.getTime() - lastMessageTime > TWO_HOURS_MS;
}
