import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('onboarding flow source', () => {
  it('keeps age while removing interests and the rename choice step', () => {
    const source = readFileSync(path.join(process.cwd(), 'app/components/Onboardingchat.tsx'), 'utf8');

    expect(source).toContain("| 'ask_age'");
    expect(source).toContain("'ask_age',");
    expect(source).toContain('How old are you?');
    expect(source).not.toContain("| 'ask_interests'");
    expect(source).not.toContain("'ask_interests',");
    expect(source).not.toContain("| 'ask_ai_name'");
    expect(source).not.toContain("'ask_ai_name',");
  });
});
