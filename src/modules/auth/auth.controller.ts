import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service';
import type { AuthenticatedUser, AuthResult } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

type RequestWithCookies = Omit<Request, 'cookies'> & {
  cookies?: Record<string, unknown>;
};

@Controller({ path: 'auth', version: '1' })
@ApiTags('Auth')
export class AuthController {
  private readonly cookieName: string;
  private readonly production: boolean;
  private readonly allowedOrigins: Set<string>;

  constructor(
    private readonly authService: AuthService,
    config: ConfigService,
  ) {
    this.cookieName = config.get<string>(
      'REFRESH_COOKIE_NAME',
      'qolmasin_refresh',
    );
    this.production = config.get<string>('NODE_ENV') === 'production';
    this.allowedOrigins = new Set(
      config
        .get<string>('FRONTEND_URL', 'http://localhost:3000')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    );
  }

  @Post('register')
  @ApiOperation({ summary: 'Create a customer account' })
  @ApiResponse({ status: 201, description: 'Account created' })
  @ApiResponse({ status: 409, description: 'Account already exists' })
  @Throttle({ global: { ttl: 3_600_000, limit: 5 } })
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(
      dto,
      this.metadata(request, dto.deviceName),
    );
    return this.withRefreshCookie(response, result);
  }

  @Post('login')
  @ApiOperation({ summary: 'Sign in and create a device session' })
  @ApiResponse({ status: 200, description: 'Signed in' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { ttl: 60_000, limit: 5 } })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(
      dto,
      this.metadata(request, dto.deviceName),
    );
    return this.withRefreshCookie(response, result);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate refresh token and issue an access token' })
  @ApiResponse({ status: 200, description: 'Token rotated' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { ttl: 60_000, limit: 30 } })
  async refresh(
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedOrigin(request);
    const rawToken = request.cookies?.[this.cookieName];
    if (typeof rawToken !== 'string' || rawToken.length > 200) {
      throw new UnauthorizedException('Authentication required');
    }
    const result = await this.authService.refresh(
      rawToken,
      this.metadata(request),
    );
    return this.withRefreshCookie(response, result);
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Verify an email address with a one-time token' })
  @ApiResponse({ status: 200, description: 'Email verified' })
  @ApiResponse({ status: 400, description: 'Token is invalid or expired' })
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { ttl: 60_000, limit: 10 } })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(dto.token);
    return { message: 'Email verified successfully' };
  }

  @Post('resend-verification')
  @ApiOperation({ summary: 'Request another email verification link' })
  @ApiResponse({ status: 202, description: 'Request accepted' })
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ global: { ttl: 600_000, limit: 3 } })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.authService.resendEmailVerification(dto.email);
    return {
      message: 'If the account is eligible, a verification email was sent',
    };
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset link' })
  @ApiResponse({ status: 202, description: 'Request accepted' })
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ global: { ttl: 3_600_000, limit: 3 } })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() request: Request,
  ) {
    await this.authService.forgotPassword(dto.email, this.metadata(request));
    return {
      message: 'If the account is eligible, a password reset email was sent',
    };
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset a password with a one-time token' })
  @ApiResponse({ status: 204, description: 'Password reset completed' })
  @ApiResponse({ status: 400, description: 'Token is invalid or expired' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ global: { ttl: 600_000, limit: 5 } })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the current device session' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(user.sessionId);
    response.clearCookie(this.cookieName, this.cookieOptions());
  }

  @Post('logout-all')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all sessions and invalidate access tokens' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logoutAll(user.sub);
    response.clearCookie(this.cookieName, this.cookieOptions());
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return {
      id: user.sub,
      phone: user.phone,
      email: user.email,
      emailVerified: Boolean(user.emailVerifiedAt),
      fullName: user.fullName,
      role: user.role,
    };
  }

  private withRefreshCookie(response: Response, result: AuthResult) {
    response.cookie(this.cookieName, result.refreshToken, {
      ...this.cookieOptions(),
      expires: result.refreshExpiresAt,
    });
    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.production,
      sameSite: 'lax',
      path: '/api/v1/auth/refresh',
    };
  }

  private metadata(request: Pick<Request, 'ip' | 'get'>, deviceName?: string) {
    return {
      ip: request.ip,
      userAgent: request.get('user-agent'),
      deviceName,
    };
  }

  private assertTrustedOrigin(request: Pick<Request, 'get'>): void {
    const origin = request.get('origin');
    if (origin && !this.allowedOrigins.has(origin)) {
      throw new ForbiddenException('Untrusted request origin');
    }
  }
}
