import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AuthenticatedUser, JwtPayload } from '../auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        phone: true,
        email: true,
        emailVerifiedAt: true,
        fullName: true,
        role: true,
        status: true,
        authVersion: true,
        deletedAt: true,
      },
    });

    if (
      !user ||
      user.status !== 'ACTIVE' ||
      user.deletedAt ||
      user.authVersion !== payload.authVersion ||
      user.role !== payload.role
    ) {
      throw new UnauthorizedException('Authentication required');
    }

    return {
      sub: user.id,
      phone: user.phone,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt,
      fullName: user.fullName,
      role: user.role,
      sessionId: payload.sessionId,
      authVersion: user.authVersion,
    };
  }
}
