import { describe, it, expect, vi } from 'vitest';
import { buildSystemPrompt } from '@/app/lib/chat/promptBuilder';

// Mock dependencies
vi.mock('@/app/lib/language/locale', () => ({
    buildLocalePrompt: vi.fn().mockReturnValue('Mocked locale prompt'),
    langCodeToName: vi.fn((code) => code === 'zh' ? 'Chinese' : 'English'),
}));

vi.mock('@/app/lib/crisis/crisisPrompts', () => ({
    buildCrisisSystemPrompt: vi.fn().mockReturnValue('Mocked crisis prompt'),
    buildExtremeSpeechPrompt: vi.fn().mockReturnValue('Mocked extreme speech prompt'),
}));

describe('promptBuilder', () => {
    const baseOptions = {
        isSafeMode: false,
        safeModeCategory: 'none' as any,
        effectiveLang: 'en',
        userAgeGroup: 'adult',
        customAiName: 'Friend AI',
        ageGroupPrompt: 'Adult behavior rules.',
        personaPrompt: 'You are gentle.',
        userPlanName: 'free',
        userProfilePrompt: 'User likes coffee.',
        crossConversationMemory: 'User previously mentioned Paris.',
        useNumberedSections: false,
        weatherPrompt: 'It is sunny today.',
    };

    it('generates crisis prompt if safeMode is true and category is self_harm', () => {
        const prompt = buildSystemPrompt({
            ...baseOptions,
            isSafeMode: true,
            safeModeCategory: 'self_harm',
        });
        expect(prompt).toBe('Mocked crisis prompt');
    });

    it('generates extreme speech prompt if safeMode is true and category is extreme_speech', () => {
        const prompt = buildSystemPrompt({
            ...baseOptions,
            isSafeMode: true,
            safeModeCategory: 'extreme_speech',
        });
        expect(prompt).toBe('Mocked extreme speech prompt');
    });

    it('includes language rules based on effectiveLang', () => {
        const prompt = buildSystemPrompt({
            ...baseOptions,
            effectiveLang: 'zh',
        });
        expect(prompt).toContain('MANDATORY LANGUAGE RULE');
        expect(prompt).toContain('You MUST respond ONLY in Chinese.');
    });

    it('injects custom AI name correctly instead of Friend AI', () => {
        const prompt = buildSystemPrompt({
            ...baseOptions,
            customAiName: 'Buddy',
        });
        expect(prompt).toContain('Your name is "Buddy".');
        // Ensure baseSystemPrompt substitution is applied
        expect(prompt).not.toContain('You are Friend AI');
        expect(prompt).toContain('You are Buddy');
    });

    it('includes user memory and profile', () => {
        const prompt = buildSystemPrompt(baseOptions);
        expect(prompt).toContain('User likes coffee.');
        expect(prompt).toContain('User previously mentioned Paris.');
    });

    it('appends numbered sections logic when true', () => {
        const prompt = buildSystemPrompt({
            ...baseOptions,
            useNumberedSections: true,
        });
        expect(prompt).toContain('When analyzing uploaded documents/files, follow this approach:');
        expect(prompt).toContain('Key Points Extraction');
    });

    it('includes learning guide for paid users', () => {
        const promptPro = buildSystemPrompt({
            ...baseOptions,
            userPlanName: 'Pro',
        });
        expect(promptPro).toContain('Learning guidance mode:');
    });

    it('excludes learning guide for free users', () => {
        const promptFree = buildSystemPrompt({
            ...baseOptions,
            userPlanName: 'free',
        });
        expect(promptFree).not.toContain('Learning guidance mode:');
    });
});
