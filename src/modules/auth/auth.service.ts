import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import { argon2id, hash as argonHash, verify as argonVerify } from 'argon2';
import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  AuthResult,
  JwtPayload,
  PublicUser,
  RequestMetadata,
} from './auth.types';

const ARGON_OPTIONS = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

type PublicUserSource = Pick<
  User,
  'id' | 'phone' | 'email' | 'emailVerifiedAt' | 'fullName' | 'role'
>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlDays: number;
  private readonly refreshSecret: string;
  private readonly ipHashSecret: string;
  private readonly emailTokenSecret: string;
  private readonly emailVerificationTtlHours: number;
  private readonly passwordResetTtlMinutes: number;
  private readonly dummyPasswordHash: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly notifications: NotificationsService,
    config: ConfigService,
  ) {
    this.accessTtlSeconds = config.get<number>('JWT_ACCESS_TTL_SECONDS', 900);
    this.refreshTtlDays = config.get<number>('REFRESH_TOKEN_TTL_DAYS', 30);
    this.refreshSecret = config.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.ipHashSecret = config.getOrThrow<string>('IP_HASH_SECRET');
    this.emailTokenSecret = config.getOrThrow<string>('EMAIL_TOKEN_SECRET');
    this.emailVerificationTtlHours = config.get<number>(
      'EMAIL_VERIFICATION_TTL_HOURS',
      24,
    );
    this.passwordResetTtlMinutes = config.get<number>(
      'PASSWORD_RESET_TTL_MINUTES',
      30,
    );
    this.dummyPasswordHash = argonHash(
      randomBytes(32).toString('base64url'),
      ARGON_OPTIONS,
    );
  }

  async register(
    dto: RegisterDto,
    metadata: RequestMetadata,
  ): Promise<AuthResult> {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ phone: dto.phone }, { email }],
      },
      select: { id: true },
    });
    if (existing) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'AUTH_ACCOUNT_EXISTS',
        'An account with these credentials already exists',
      );
    }

    const sessionId = randomUUID();
    const verification = this.createOneTimeToken(
      this.emailVerificationTtlHours * 60 * 60 * 1_000,
    );
    const [passwordHash, session] = await Promise.all([
      argonHash(dto.password, ARGON_OPTIONS),
      this.createSessionMaterial(sessionId),
    ]);

    try {
      const user = await this.prisma.$transaction(async (transaction) => {
        const createdUser = await transaction.user.create({
          data: {
            phone: dto.phone,
            email,
            fullName: dto.fullName,
            passwordHash,
          },
        });
        await transaction.authSession.create({
          data: {
            id: sessionId,
            userId: createdUser.id,
            refreshTokenHash: session.hash,
            refreshTokenFingerprint: session.fingerprint,
            expiresAt: session.expiresAt,
            userAgent: this.cleanUserAgent(metadata.userAgent),
            ipHash: this.hashIp(metadata.ip),
            deviceName: dto.deviceName,
          },
        });
        await transaction.emailVerificationToken.create({
          data: {
            userId: createdUser.id,
            email,
            tokenHash: verification.hash,
            expiresAt: verification.expiresAt,
          },
        });
        return createdUser;
      });

      await this.safelySendEmail(
        () =>
          this.notifications.sendEmailVerification(
            email,
            user.fullName,
            verification.rawToken,
          ),
        'email_verification',
      );

      return this.createAuthResult(user, sessionId, session);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'AUTH_ACCOUNT_EXISTS',
          'An account with these credentials already exists',
        );
      }
      throw error;
    }
  }

  async login(dto: LoginDto, metadata: RequestMetadata): Promise<AuthResult> {
    const identifier = dto.identifier.toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: identifier.startsWith('+')
        ? { phone: identifier }
        : { email: identifier },
    });

    const passwordHash = user?.passwordHash ?? (await this.dummyPasswordHash);
    const passwordValid = await argonVerify(passwordHash, dto.password).catch(
      () => false,
    );
    if (!user || !passwordValid || user.status !== 'ACTIVE' || user.deletedAt) {
      throw this.invalidCredentials();
    }

    const sessionId = randomUUID();
    const session = await this.createSessionMaterial(sessionId);
    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: session.hash,
        refreshTokenFingerprint: session.fingerprint,
        expiresAt: session.expiresAt,
        userAgent: this.cleanUserAgent(metadata.userAgent),
        ipHash: this.hashIp(metadata.ip),
        deviceName: dto.deviceName,
      },
    });

    return this.createAuthResult(user, sessionId, session);
  }

  async refresh(
    rawRefreshToken: string,
    metadata: RequestMetadata,
  ): Promise<AuthResult> {
    const sessionId = this.getSessionId(rawRefreshToken);
    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
    const now = new Date();

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.user.status !== 'ACTIVE' ||
      session.user.deletedAt
    ) {
      throw this.invalidRefreshToken();
    }

    const fingerprint = this.fingerprint(rawRefreshToken);
    const fingerprintMatches = this.safeEqual(
      fingerprint,
      session.refreshTokenFingerprint,
    );
    const hashMatches = fingerprintMatches
      ? await argonVerify(session.refreshTokenHash, rawRefreshToken).catch(
          () => false,
        )
      : false;

    if (!fingerprintMatches || !hashMatches) {
      await this.revokeSession(sessionId);
      throw this.invalidRefreshToken();
    }

    const rotated = await this.createSessionMaterial(
      sessionId,
      session.expiresAt,
    );
    const update = await this.prisma.authSession.updateMany({
      where: {
        id: sessionId,
        refreshTokenFingerprint: session.refreshTokenFingerprint,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        refreshTokenHash: rotated.hash,
        refreshTokenFingerprint: rotated.fingerprint,
        lastUsedAt: now,
        userAgent: this.cleanUserAgent(metadata.userAgent),
        ipHash: this.hashIp(metadata.ip),
      },
    });

    if (update.count !== 1) {
      await this.revokeSession(sessionId);
      throw this.invalidRefreshToken();
    }

    return this.createAuthResult(session.user, sessionId, rotated);
  }

  async logout(sessionId: string): Promise<void> {
    await this.revokeSession(sessionId);
  }

  async logoutAll(userId: string): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { authVersion: { increment: 1 } },
      }),
    ]);
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const tokenHash = this.emailTokenHash(rawToken);
    const now = new Date();

    await this.prisma.$transaction(
      async (transaction) => {
        const token = await transaction.emailVerificationToken.findUnique({
          where: { tokenHash },
          include: { user: true },
        });
        if (
          !token ||
          token.usedAt ||
          token.expiresAt <= now ||
          token.user.email !== token.email ||
          token.user.status !== 'ACTIVE' ||
          token.user.deletedAt
        ) {
          throw this.invalidOneTimeToken(
            'AUTH_INVALID_EMAIL_VERIFICATION_TOKEN',
          );
        }

        const consumed = await transaction.emailVerificationToken.updateMany({
          where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now },
        });
        if (consumed.count !== 1) {
          throw this.invalidOneTimeToken(
            'AUTH_INVALID_EMAIL_VERIFICATION_TOKEN',
          );
        }

        if (!token.user.emailVerifiedAt) {
          await transaction.user.update({
            where: { id: token.userId },
            data: { emailVerifiedAt: now },
          });
        }
        await transaction.emailVerificationToken.updateMany({
          where: { userId: token.userId, usedAt: null },
          data: { usedAt: now },
        });
      },
      { maxWait: 10_000, timeout: 15_000 },
    );
  }

  async resendEmailVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (
      !user ||
      user.emailVerifiedAt ||
      user.status !== 'ACTIVE' ||
      user.deletedAt ||
      !user.email
    ) {
      this.emailTokenHash(randomBytes(48).toString('base64url'));
      return;
    }

    const token = this.createOneTimeToken(
      this.emailVerificationTtlHours * 60 * 60 * 1_000,
    );
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      }),
      this.prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          email: user.email,
          tokenHash: token.hash,
          expiresAt: token.expiresAt,
        },
      }),
    ]);
    await this.safelySendEmail(
      () =>
        this.notifications.sendEmailVerification(
          user.email!,
          user.fullName,
          token.rawToken,
        ),
      'email_verification_resend',
    );
  }

  async forgotPassword(
    email: string,
    metadata: RequestMetadata,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (
      !user ||
      !user.emailVerifiedAt ||
      user.status !== 'ACTIVE' ||
      user.deletedAt ||
      !user.email
    ) {
      this.emailTokenHash(randomBytes(48).toString('base64url'));
      return;
    }

    const token = this.createOneTimeToken(
      this.passwordResetTtlMinutes * 60 * 1_000,
    );
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          email: user.email,
          tokenHash: token.hash,
          requestedIpHash: this.hashIp(metadata.ip),
          expiresAt: token.expiresAt,
        },
      }),
    ]);
    await this.safelySendEmail(
      () =>
        this.notifications.sendPasswordReset(
          user.email!,
          user.fullName,
          token.rawToken,
        ),
      'password_reset',
    );
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = this.emailTokenHash(rawToken);
    const token = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    const now = new Date();
    if (
      !token ||
      token.usedAt ||
      token.expiresAt <= now ||
      token.user.email !== token.email ||
      token.user.status !== 'ACTIVE' ||
      token.user.deletedAt
    ) {
      throw this.invalidOneTimeToken('AUTH_INVALID_PASSWORD_RESET_TOKEN');
    }

    const passwordHash = await argonHash(newPassword, ARGON_OPTIONS);
    await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.passwordResetToken.updateMany({
        where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) {
        throw this.invalidOneTimeToken('AUTH_INVALID_PASSWORD_RESET_TOKEN');
      }

      await transaction.user.update({
        where: { id: token.userId },
        data: {
          passwordHash,
          authVersion: { increment: 1 },
        },
      });
      await transaction.authSession.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await transaction.passwordResetToken.updateMany({
        where: { userId: token.userId, usedAt: null },
        data: { usedAt: now },
      });
    });

    if (token.user.email) {
      await this.safelySendEmail(
        () =>
          this.notifications.sendPasswordChanged(
            token.user.email!,
            token.user.fullName,
          ),
        'password_changed',
      );
    }
  }

  private async createAuthResult(
    user: PublicUserSource & { authVersion: number },
    sessionId: string,
    session: {
      rawToken: string;
      expiresAt: Date;
    },
  ): Promise<AuthResult> {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      sessionId,
      authVersion: user.authVersion,
    };
    return {
      accessToken: await this.jwtService.signAsync(payload, {
        expiresIn: this.accessTtlSeconds,
      }),
      refreshToken: session.rawToken,
      refreshExpiresAt: session.expiresAt,
      user: this.toPublicUser(user),
    };
  }

  private async createSessionMaterial(sessionId: string, expiresAt?: Date) {
    const secret = randomBytes(48).toString('base64url');
    const rawToken = `${sessionId}.${secret}`;
    const resolvedExpiry =
      expiresAt ??
      new Date(Date.now() + this.refreshTtlDays * 24 * 60 * 60 * 1_000);
    return {
      rawToken,
      hash: await argonHash(rawToken, ARGON_OPTIONS),
      fingerprint: this.fingerprint(rawToken),
      expiresAt: resolvedExpiry,
    };
  }

  private getSessionId(rawToken: string): string {
    const match = rawToken.match(
      /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.[A-Za-z0-9_-]{64}$/i,
    );
    if (!match) {
      throw this.invalidRefreshToken();
    }
    return match[1];
  }

  private fingerprint(value: string): string {
    return createHmac('sha256', this.refreshSecret).update(value).digest('hex');
  }

  private emailTokenHash(value: string): string {
    return createHmac('sha256', this.emailTokenSecret)
      .update(value)
      .digest('hex');
  }

  private createOneTimeToken(ttlMs: number) {
    const rawToken = randomBytes(48).toString('base64url');
    return {
      rawToken,
      hash: this.emailTokenHash(rawToken),
      expiresAt: new Date(Date.now() + ttlMs),
    };
  }

  private hashIp(ip?: string): string | null {
    if (!ip) return null;
    return createHmac('sha256', this.ipHashSecret).update(ip).digest('hex');
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private cleanUserAgent(userAgent?: string): string | null {
    return userAgent?.replace(/[\r\n]/g, '').slice(0, 512) || null;
  }

  private async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private toPublicUser(user: PublicUserSource): PublicUser {
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      emailVerified: Boolean(user.emailVerifiedAt),
      fullName: user.fullName,
      role: user.role,
    };
  }

  private invalidCredentials(): AppException {
    return new AppException(
      HttpStatus.UNAUTHORIZED,
      'AUTH_INVALID_CREDENTIALS',
      'Invalid phone/email or password',
    );
  }

  private invalidRefreshToken(): AppException {
    return new AppException(
      HttpStatus.UNAUTHORIZED,
      'AUTH_INVALID_REFRESH_TOKEN',
      'Authentication required',
    );
  }

  private invalidOneTimeToken(code: string): AppException {
    return new AppException(
      HttpStatus.BAD_REQUEST,
      code,
      'The token is invalid or has expired',
    );
  }

  private async safelySendEmail(
    operation: () => Promise<void>,
    event: string,
  ): Promise<void> {
    try {
      await operation();
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Email delivery failed for event: ${event}: ${reason}`);
    }
  }
}
