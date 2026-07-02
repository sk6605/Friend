import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import bcrypt from 'bcrypt';
import { prisma } from '@/app/lib/db';
import { POST as loginPost } from '@/app/api/auth/login/route';
import { POST as createOnboardingPost } from '@/app/api/onboarding/create/route';

vi.mock('@/app/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    conversation: {
      create: vi.fn(),
    },
    otp: {
      updateMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const mockUserFindUnique = prisma.user.findUnique as unknown as Mock;
const mockUserCreate = prisma.user.create as unknown as Mock;
const mockConversationCreate = prisma.conversation.create as unknown as Mock;
const mockOtpUpdateMany = prisma.otp.updateMany as unknown as Mock;
const mockOtpCreate = prisma.otp.create as unknown as Mock;
const mockBcryptCompare = bcrypt.compare as unknown as Mock;
const mockBcryptHash = bcrypt.hash as unknown as Mock;

describe('password auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs in with email and password without issuing an OTP', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'kai@gmail.com',
      password: 'hashed-password',
    });
    mockBcryptCompare.mockResolvedValue(true);

    const res = await loginPost(jsonRequest({
      email: ' Kai@Gmail.com ',
      password: '12345678',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, userId: 'user-1' });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'kai@gmail.com' },
    });
    expect(bcrypt.compare).toHaveBeenCalledWith('12345678', 'hashed-password');
    expect(mockOtpUpdateMany).not.toHaveBeenCalled();
    expect(mockOtpCreate).not.toHaveBeenCalled();
    expect(body.devOtp).toBeUndefined();
  });

  it('rejects an invalid password with a generic login error', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'kai@gmail.com',
      password: 'hashed-password',
    });
    mockBcryptCompare.mockResolvedValue(false);

    const res = await loginPost(jsonRequest({
      email: 'kai@gmail.com',
      password: 'bad-pass',
    }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Invalid email or password');
    expect(mockOtpCreate).not.toHaveBeenCalled();
  });

  it('stores a bcrypt hash when creating an onboarding account', async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockBcryptHash.mockResolvedValue('hashed-new-password');
    mockUserCreate.mockResolvedValue({
      id: 'new-user',
      nickname: 'Kai',
    });
    mockConversationCreate.mockResolvedValue({ id: 'conv-1' });

    const res = await createOnboardingPost(jsonRequest({
      username: 'Kai',
      email: ' Kai@Gmail.com ',
      password: '12345678',
      aiName: 'Nova',
      language: 'en',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ id: 'new-user' });
    expect(bcrypt.hash).toHaveBeenCalledWith('12345678', 12);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        username: 'Kai',
        nickname: 'Kai',
        email: 'kai@gmail.com',
        password: 'hashed-new-password',
        aiName: 'Nova',
        ageGroup: 'adult',
        language: 'en',
      }),
    });
  });

  it('rejects onboarding passwords shorter than 8 characters', async () => {
    const res = await createOnboardingPost(jsonRequest({
      username: 'Kai',
      email: 'kai@gmail.com',
      password: '1234567',
      aiName: 'Nova',
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Password must be at least 8 characters');
    expect(mockUserCreate).not.toHaveBeenCalled();
  });
});
