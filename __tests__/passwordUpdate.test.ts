import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import bcrypt from 'bcrypt';
import { prisma } from '@/app/lib/db';
import { PATCH } from '@/app/api/users/[id]/password/route';

vi.mock('@/app/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
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
  return new Request('http://localhost/api/users/user-1/password', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const mockUserFindUnique = prisma.user.findUnique as unknown as Mock;
const mockUserUpdate = prisma.user.update as unknown as Mock;
const mockBcryptCompare = bcrypt.compare as unknown as Mock;
const mockBcryptHash = bcrypt.hash as unknown as Mock;

describe('password update route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates the password when the current password matches', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'user-1',
      password: 'old-hash',
    });
    mockBcryptCompare.mockResolvedValue(true);
    mockBcryptHash.mockResolvedValue('new-hash');
    mockUserUpdate.mockResolvedValue({ id: 'user-1' });

    const res = await PATCH(jsonRequest({
      currentPassword: 'oldpass123',
      newPassword: 'newpass123',
    }), {
      params: Promise.resolve({ id: 'user-1' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(bcrypt.compare).toHaveBeenCalledWith('oldpass123', 'old-hash');
    expect(bcrypt.hash).toHaveBeenCalledWith('newpass123', 12);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { password: 'new-hash' },
    });
  });

  it('rejects a wrong current password', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'user-1',
      password: 'old-hash',
    });
    mockBcryptCompare.mockResolvedValue(false);

    const res = await PATCH(jsonRequest({
      currentPassword: 'wrongpass',
      newPassword: 'newpass123',
    }), {
      params: Promise.resolve({ id: 'user-1' }),
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Current password is incorrect');
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });
});
