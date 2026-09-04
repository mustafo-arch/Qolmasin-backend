import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import { argon2id, hash } from 'argon2';
import { createHmac, randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthService } from './auth.service';

const refreshSecret = 'r'.repeat(48);
const ipHashSecret = 'i'.repeat(48);
const emailTokenSecret = 'e'.repeat(48);

function createService(prismaMock: object) {
  const jwtMock = {
    signAsync: jest.fn().mockResolvedValue('signed-access-token'),
  };
  const configMock = {
    get: jest.fn((key: string, fallback: unknown) => {
      if (key === 'JWT_ACCESS_TTL_SECONDS') return 900;
      if (key === 'REFRESH_TOKEN_TTL_DAYS') return 30;
      if (key === 'EMAIL_VERIFICATION_TTL_HOURS') return 24;
      if (key === 'PASSWORD_RESET_TTL_MINUTES') return 30;
      return fallback;
    }),
    getOrThrow: jest.fn((key: string) => {
      if (key === 'JWT_REFRESH_SECRET') return refreshSecret;
      if (key === 'IP_HASH_SECRET') return ipHashSecret;
      if (key === 'EMAIL_TOKEN_SECRET') return emailTokenSecret;
      throw new Error(`Unexpected config key: ${key}`);
    }),
  };
  const notificationsMock = {
    sendEmailVerification: jest.fn().mockResolvedValue(undefined),
    sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    sendPasswordChanged: jest.fn().mockResolvedValue(undefined),
  };

  return {
    service: new AuthService(
      prismaMock as PrismaService,
      jwtMock as unknown as JwtService,
      notificationsMock as unknown as NotificationsService,
      configMock as unknown as ConfigService,
    ),
    jwtMock,
    notificationsMock,
  };
}

describe('AuthService', () => {
  const activeUser = {
    id: randomUUID(),
    phone: '+998901234567',
    email: 'user@example.com',
    emailVerifiedAt: new Date(),
    passwordHash: '',
    fullName: 'Test User',
    role: UserRole.CUSTOMER,
    status: UserStatus.ACTIVE,
    authVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeAll(async () => {
    activeUser.passwordHash = await hash('SecurePass123', {
      type: argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  });

  it('creates a session and never returns a password hash on login', async () => {
    const prismaMock = {
      user: { findFirst: jest.fn().mockResolvedValue(activeUser) },
      authSession: { create: jest.fn().mockResolvedValue({}) },
    };
    const { service } = createService(prismaMock);

    const result = await service.login(
      { identifier: activeUser.phone, password: 'SecurePass123' },
      { ip: '127.0.0.1', userAgent: 'jest' },
    );

    expect(result.accessToken).toBe('signed-access-token');
    expect(result.refreshToken).toMatch(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{64}$/);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(prismaMock.authSession.create).toHaveBeenCalledTimes(1);
  });

  it('uses a generic error when the account does not exist', async () => {
    const prismaMock = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
      authSession: { create: jest.fn() },
    };
    const { service } = createService(prismaMock);

    await expect(
      service.login(
        { identifier: 'missing@example.com', password: 'wrong' },
        {},
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('rotates a valid refresh token atomically', async () => {
    const sessionId = randomUUID();
    const rawToken = `${sessionId}.${'a'.repeat(64)}`;
    const storedHash = await hash(rawToken, {
      type: argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
    const fingerprint = createHmac('sha256', refreshSecret)
      .update(rawToken)
      .digest('hex');
    const prismaMock = {
      authSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: sessionId,
          refreshTokenHash: storedHash,
          refreshTokenFingerprint: fingerprint,
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
          user: activeUser,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const { service } = createService(prismaMock);

    const result = await service.refresh(rawToken, { ip: '127.0.0.1' });

    expect(result.refreshToken).not.toBe(rawToken);
    expect(prismaMock.authSession.updateMany).toHaveBeenCalledTimes(1);
  });

  it('consumes an email verification token and verifies the same email', async () => {
    const rawToken = 'v'.repeat(64);
    const tokenHash = createHmac('sha256', emailTokenSecret)
      .update(rawToken)
      .digest('hex');
    const transactionMock = {
      emailVerificationToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: randomUUID(),
          userId: activeUser.id,
          email: activeUser.email,
          tokenHash,
          usedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          user: { ...activeUser, emailVerifiedAt: null },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: { update: jest.fn().mockResolvedValue({}) },
    };
    const prismaMock = {
      $transaction: jest.fn(
        (operation: (transaction: typeof transactionMock) => unknown) =>
          Promise.resolve(operation(transactionMock)),
      ),
    };
    const { service } = createService(prismaMock);

    await service.verifyEmail(rawToken);

    expect(transactionMock.user.update).toHaveBeenCalledTimes(1);
    expect(
      transactionMock.emailVerificationToken.updateMany,
    ).toHaveBeenCalledTimes(2);
  });

  it('resets the password, revokes sessions, and sends a notification', async () => {
    const rawToken = 'p'.repeat(64);
    const tokenHash = createHmac('sha256', emailTokenSecret)
      .update(rawToken)
      .digest('hex');
    const transactionMock = {
      passwordResetToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: { update: jest.fn().mockResolvedValue({}) },
      authSession: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const prismaMock = {
      passwordResetToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: randomUUID(),
          userId: activeUser.id,
          email: activeUser.email,
          tokenHash,
          usedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          user: activeUser,
        }),
      },
      $transaction: jest.fn(
        (operation: (transaction: typeof transactionMock) => unknown) =>
          Promise.resolve(operation(transactionMock)),
      ),
    };
    const { service, notificationsMock } = createService(prismaMock);

    await service.resetPassword(rawToken, 'NewSecurePass456');

    expect(transactionMock.user.update).toHaveBeenCalledTimes(1);
    expect(transactionMock.authSession.updateMany).toHaveBeenCalledTimes(1);
    expect(notificationsMock.sendPasswordChanged).toHaveBeenCalledTimes(1);
  });
});
