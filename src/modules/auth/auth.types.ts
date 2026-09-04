import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  sessionId: string;
  authVersion: number;
}

export interface AuthenticatedUser extends JwtPayload {
  phone: string;
  email: string | null;
  emailVerifiedAt: Date | null;
  fullName: string;
}

export interface RequestMetadata {
  ip?: string;
  userAgent?: string;
  deviceName?: string;
}

export interface PublicUser {
  id: string;
  phone: string;
  email: string | null;
  emailVerified: boolean;
  fullName: string;
  role: UserRole;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: PublicUser;
}
