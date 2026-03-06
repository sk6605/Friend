import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assessCrisisRisk } from '@/app/lib/crisis/crisisDetector';

const mockCreate = vi.fn();

vi.mock('openai', () => {
    return {
        default: class OpenAI {
            chat = {
                completions: {
                    create: mockCreate,
                }
            }
        }
    };
});

describe('CrisisDetector', () => {
    beforeEach(() => {
        mockCreate.mockReset();
        process.env.OPENAI_API_KEY = 'test-key';
    });

    it('returns level 0 if no keywords are matched', async () => {
        const result = await assessCrisisRisk('I am doing great today', [], 'adult');
        expect(result.riskLevel).toBe(0);
        expect(result.category).toBe('none');
        expect(result.matchedKeywords).toEqual([]);
    });

    it('matches self_harm high-weight keywords', async () => {
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: '{"riskLevel":3,"reason":"Immediate threat","isImmediateDanger":true,"category":"self_harm"}' } }],
        });

        const result = await assessCrisisRisk('I want to kill myself', [], 'adult');

        expect(result.matchedKeywords).toContain('kill myself');
        expect(result.riskLevel).toBe(3);
        expect(result.category).toBe('self_harm');
    });

    it('matches extreme_speech high-weight keywords', async () => {
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: '{"riskLevel":3,"reason":"Bomb threat","isImmediateDanger":true,"category":"extreme_speech"}' } }],
        });

        const result = await assessCrisisRisk('I am going to plant a bomb', [], 'adult');

        expect(result.matchedKeywords).toContain('plant a bomb');
        expect(result.riskLevel).toBe(3);
        expect(result.category).toBe('extreme_speech');
    });

    it('handles OpenAI classification fallback on error', async () => {
        // Force OpenAI to throw
        mockCreate.mockRejectedValue(new Error('API Down'));

        const result = await assessCrisisRisk('I feel like cutting myself', [], 'teen');

        // Fallback to level 2 for high-weight keyword
        expect(result.riskLevel).toBe(2);
        expect(result.reason).toContain('AI classification failed');
        expect(result.category).toBe('self_harm');
    });
});
