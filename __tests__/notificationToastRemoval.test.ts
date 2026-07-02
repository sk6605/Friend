import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('home notifications', () => {
  it('keeps browser push setup but removes accumulated in-app toast cards', () => {
    const pageSource = readFileSync(path.join(process.cwd(), 'app/page.tsx'), 'utf8');

    expect(pageSource).toContain('usePushNotifications');
    expect(pageSource).not.toContain('NotificationToast');
    expect(pageSource).not.toContain('useNotifications');
  });
});
