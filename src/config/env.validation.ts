import { plainToInstance, Type } from 'class-transformer';
import { randomBytes } from 'node:crypto';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

class Environment {
  @IsIn(['development', 'test', 'staging', 'production'])
  NODE_ENV = 'development';

  @IsInt()
  @Min(1)
  @Max(65_535)
  @Type(() => Number)
  PORT = 3000;

  @IsString()
  @IsOptional()
  FRONTEND_URL?: string;

  @IsString()
  @IsOptional()
  DATABASE_URL?: string;

  @IsIn(['local', 'supabase'])
  STORAGE_DRIVER = 'local';

  @IsString()
  @IsOptional()
  API_PUBLIC_URL?: string;

  @IsString()
  UPLOAD_LOCAL_DIR = '.local-uploads';

  @IsInt()
  @Min(1_024)
  @Max(5_242_880)
  @Type(() => Number)
  UPLOAD_MAX_BYTES = 5_242_880;

  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  PRODUCT_IMAGE_LIMIT = 5;

  @IsString()
  @IsOptional()
  SUPABASE_URL?: string;

  @IsString()
  @MinLength(32)
  @IsOptional()
  SUPABASE_SERVICE_ROLE_KEY?: string;

  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/)
  SUPABASE_STORAGE_BUCKET = 'product-images';

  @IsString()
  @MinLength(32)
  @IsOptional()
  JWT_ACCESS_SECRET?: string;

  @IsString()
  @MinLength(32)
  @IsOptional()
  JWT_REFRESH_SECRET?: string;

  @IsString()
  @MinLength(32)
  @IsOptional()
  IP_HASH_SECRET?: string;

  @IsString()
  @MinLength(32)
  @IsOptional()
  EMAIL_TOKEN_SECRET?: string;

  @IsString()
  @MaxLength(255)
  @Matches(/^[^\r\n]+$/)
  @IsOptional()
  SMTP_HOST?: string;

  @IsString()
  @Matches(/^\d+$/)
  @IsOptional()
  SMTP_PORT?: string;

  @IsIn(['true', 'false'])
  @IsOptional()
  SMTP_SECURE?: string;

  @IsString()
  @MaxLength(254)
  @Matches(/^[^\r\n]+$/)
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @MaxLength(255)
  @Matches(/^[^\r\n]+$/)
  @IsOptional()
  SMTP_PASS?: string;

  @IsString()
  @MaxLength(254)
  @Matches(/^[^\r\n]+$/)
  @IsOptional()
  EMAIL_FROM?: string;

  @IsInt()
  @Min(300)
  @Max(1_200)
  @Type(() => Number)
  JWT_ACCESS_TTL_SECONDS = 900;

  @IsInt()
  @Min(7)
  @Max(30)
  @Type(() => Number)
  REFRESH_TOKEN_TTL_DAYS = 30;

  @IsString()
  REFRESH_COOKIE_NAME = 'qolmasin_refresh';

  @IsInt()
  @Min(1)
  @Max(1_000)
  @Type(() => Number)
  GLOBAL_RATE_LIMIT = 100;

  @IsInt()
  @Min(1_000)
  @Max(3_600_000)
  @Type(() => Number)
  GLOBAL_RATE_LIMIT_TTL_MS = 60_000;

  @IsInt()
  @Min(1)
  @Max(72)
  @Type(() => Number)
  EMAIL_VERIFICATION_TTL_HOURS = 24;

  @IsInt()
  @Min(10)
  @Max(60)
  @Type(() => Number)
  PASSWORD_RESET_TTL_MINUTES = 30;

  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  LOW_STOCK_THRESHOLD = 3;

  @IsInt()
  @Min(5)
  @Max(60)
  @Type(() => Number)
  RESERVATION_TTL_MINUTES = 15;

  @IsInt()
  @Min(10)
  @Max(300)
  @Type(() => Number)
  ORDER_EXPIRY_INTERVAL_SECONDS = 60;

  @IsInt()
  @Min(3)
  @Max(10)
  @Type(() => Number)
  PICKUP_MAX_ATTEMPTS = 5;

  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  NEARBY_MAX_RADIUS_KM = 50;

  @IsInt()
  @Min(1)
  @Max(1_000)
  @Type(() => Number)
  PRICE_INCREASE_ALERT_PERCENT = 40;

  @IsString()
  @MinLength(32)
  @IsOptional()
  PICKUP_CODE_SECRET?: string;
}

export function envValidation(config: Record<string, unknown>) {
  const environment = plainToInstance(Environment, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(environment, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.toString()}`);
  }

  if (environment.FRONTEND_URL) {
    const origins = environment.FRONTEND_URL.split(',').map((value) =>
      value.trim(),
    );
    const invalidOrigin = origins.some((origin) => {
      try {
        const url = new URL(origin);
        return (
          !['http:', 'https:'].includes(url.protocol) || Boolean(url.username)
        );
      } catch {
        return true;
      }
    });
    if (invalidOrigin) {
      throw new Error('FRONTEND_URL contains an invalid origin');
    }
  }

  for (const [name, value] of [
    ['API_PUBLIC_URL', environment.API_PUBLIC_URL],
    ['SUPABASE_URL', environment.SUPABASE_URL],
  ] as const) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || url.username) {
        throw new Error();
      }
    } catch {
      throw new Error(`${name} must be a valid HTTP(S) URL`);
    }
  }

  if (
    environment.STORAGE_DRIVER === 'supabase' &&
    (!environment.SUPABASE_URL || !environment.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Supabase storage',
    );
  }

  if (environment.NODE_ENV === 'production') {
    const requiredSecrets = [
      'DATABASE_URL',
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'IP_HASH_SECRET',
      'EMAIL_TOKEN_SECRET',
      'PICKUP_CODE_SECRET',
      'FRONTEND_URL',
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASS',
      'EMAIL_FROM',
    ] as const;
    const missing = requiredSecrets.filter((name) => !environment[name]);
    if (missing.length > 0) {
      throw new Error(
        `Missing production environment variables: ${missing.join(', ')}`,
      );
    }
    if (environment.STORAGE_DRIVER !== 'supabase') {
      throw new Error('Production STORAGE_DRIVER must be supabase');
    }
  }

  environment.JWT_ACCESS_SECRET ??= randomBytes(48).toString('base64url');
  environment.JWT_REFRESH_SECRET ??= randomBytes(48).toString('base64url');
  environment.IP_HASH_SECRET ??= randomBytes(48).toString('base64url');
  environment.EMAIL_TOKEN_SECRET ??= randomBytes(48).toString('base64url');
  environment.PICKUP_CODE_SECRET ??= randomBytes(48).toString('base64url');

  return environment;
}
