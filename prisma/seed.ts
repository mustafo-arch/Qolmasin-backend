import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { argon2id, hash, verify } from 'argon2';
import { readAdminSeedConfig } from '../src/config/admin-seed.validation';
import {
  AuditAction,
  AuditEntityType,
} from '../src/modules/audit/audit.constants';

const prisma = new PrismaClient();

async function seedAdmin(): Promise<'created' | 'updated'> {
  const config = readAdminSeedConfig(process.env);
  const [emailUser, phoneUser] = await Promise.all([
    prisma.user.findUnique({ where: { email: config.email } }),
    prisma.user.findUnique({ where: { phone: config.phone } }),
  ]);

  if (emailUser && phoneUser && emailUser.id !== phoneUser.id) {
    throw new Error(
      'SEED_ADMIN_EMAIL and SEED_ADMIN_PHONE belong to different accounts',
    );
  }

  const existing = emailUser ?? phoneUser;
  if (
    existing &&
    (existing.email !== config.email || existing.phone !== config.phone)
  ) {
    throw new Error(
      'Admin seed identity conflicts with an existing email or phone',
    );
  }
  if (existing?.role === UserRole.SUPER_ADMIN) {
    throw new Error(
      'Refusing to downgrade an existing SUPER_ADMIN through the seed',
    );
  }

  if (!existing) {
    const passwordHash = await createPasswordHash(config.password);
    await prisma.$transaction(async (transaction) => {
      const admin = await transaction.user.create({
        data: {
          email: config.email,
          phone: config.phone,
          fullName: config.fullName,
          passwordHash,
          emailVerifiedAt: new Date(),
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: admin.id,
          actorRole: UserRole.ADMIN,
          action: AuditAction.ADMIN_BOOTSTRAPPED,
          entityType: AuditEntityType.USER,
          entityId: admin.id,
          metadata: { created: true },
        },
      });
    });
    return 'created';
  }

  const passwordChanged = !(await verify(
    existing.passwordHash,
    config.password,
  ));
  const passwordHash = passwordChanged
    ? await createPasswordHash(config.password)
    : undefined;
  const now = new Date();
  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: existing.id },
      data: {
        fullName: config.fullName,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        emailVerifiedAt: existing.emailVerifiedAt ?? now,
        passwordHash,
        authVersion: passwordChanged ? { increment: 1 } : undefined,
      },
    });
    if (passwordChanged) {
      await transaction.authSession.updateMany({
        where: { userId: existing.id, revokedAt: null },
        data: { revokedAt: now },
      });
    }
    await transaction.auditLog.create({
      data: {
        actorUserId: existing.id,
        actorRole: UserRole.ADMIN,
        action: AuditAction.ADMIN_BOOTSTRAPPED,
        entityType: AuditEntityType.USER,
        entityId: existing.id,
        metadata: {
          created: false,
          passwordRotated: passwordChanged,
          previousRole: existing.role,
          previousStatus: existing.status,
        },
      },
    });
  });
  return 'updated';
}

function createPasswordHash(password: string): Promise<string> {
  return hash(password, {
    type: argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

async function main(): Promise<void> {
  const result = await seedAdmin();
  console.info(`Admin seed completed: ${result}`);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Admin seed failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
