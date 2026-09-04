import { BusinessStatus, BusinessType, UserRole } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BusinessAccessService } from '../business-members/business-access.service';
import { BusinessesService } from './businesses.service';

const user: AuthenticatedUser = {
  sub: 'c6a67df6-6756-4df7-8436-c654f277057c',
  role: UserRole.CUSTOMER,
  sessionId: '99f714ff-34ed-4133-9d1c-dcb514448642',
  authVersion: 0,
  phone: '+998901234567',
  email: 'owner@example.com',
  emailVerifiedAt: new Date(),
  fullName: 'Owner',
};

const moderator: AuthenticatedUser = {
  ...user,
  sub: '9038cb70-d11b-4e33-957c-53d35e9a973e',
  role: UserRole.MODERATOR,
};

describe('BusinessesService', () => {
  const audit = { record: jest.fn().mockResolvedValue({}) };

  it('requires a verified email before business creation', async () => {
    const service = new BusinessesService(
      {} as PrismaService,
      {} as BusinessAccessService,
      audit as unknown as AuditService,
    );

    await expect(
      service.create(
        { ...user, emailVerifiedAt: null },
        { name: 'Bakery', type: BusinessType.BAKERY },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('creates the business and owner membership in one transaction', async () => {
    const now = new Date();
    const business = {
      id: 'a8b1aeb7-5f38-47f9-9c25-b10e8d41d44e',
      ownerId: user.sub,
      name: 'Bakery',
      slug: 'bakery-aabbccdd',
      description: null,
      type: BusinessType.BAKERY,
      status: 'DRAFT' as const,
      verifiedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    const transaction = {
      business: { create: jest.fn().mockResolvedValue(business) },
      businessMember: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn(
        (operation: (value: typeof transaction) => unknown) =>
          Promise.resolve(operation(transaction)),
      ),
    };
    const service = new BusinessesService(
      prisma as unknown as PrismaService,
      {} as BusinessAccessService,
      audit as unknown as AuditService,
    );

    const result = await service.create(user, {
      name: 'Bakery',
      type: BusinessType.BAKERY,
    });

    expect(result.id).toBe(business.id);
    expect(transaction.business.create).toHaveBeenCalledTimes(1);
    expect(transaction.businessMember.create).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledTimes(1);
  });

  it('verifies a pending business and writes the audit in the same transaction', async () => {
    const now = new Date();
    const pendingBusiness = {
      id: 'a8b1aeb7-5f38-47f9-9c25-b10e8d41d44e',
      ownerId: user.sub,
      reviewedById: null,
      name: 'Bakery',
      slug: 'bakery-aabbccdd',
      description: null,
      type: BusinessType.BAKERY,
      status: BusinessStatus.PENDING_REVIEW,
      statusReason: null,
      verifiedAt: null,
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    const reviewedBusiness = {
      ...pendingBusiness,
      status: BusinessStatus.VERIFIED,
      verifiedAt: now,
      reviewedAt: now,
      reviewedById: moderator.sub,
      owner: {
        id: user.sub,
        fullName: user.fullName,
        email: user.email,
      },
      _count: { branches: 1, products: 0 },
    };
    let capturedUpdateInput: unknown;
    const transaction = {
      business: {
        findFirst: jest.fn().mockResolvedValue(pendingBusiness),
        updateMany: jest.fn((input: unknown) => {
          capturedUpdateInput = input;
          return Promise.resolve({ count: 1 });
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(reviewedBusiness),
      },
      branch: { count: jest.fn().mockResolvedValue(1) },
    };
    const prisma = {
      $transaction: jest.fn(
        (operation: (value: typeof transaction) => unknown) =>
          Promise.resolve(operation(transaction)),
      ),
    };
    const service = new BusinessesService(
      prisma as unknown as PrismaService,
      {} as BusinessAccessService,
      audit as unknown as AuditService,
    );

    const result = await service.review(moderator, pendingBusiness.id, {
      status: BusinessStatus.VERIFIED,
    });

    expect(result.status).toBe(BusinessStatus.VERIFIED);
    const updateInput = capturedUpdateInput as {
      where: { status: BusinessStatus };
    };
    expect(updateInput.where.status).toBe(BusinessStatus.PENDING_REVIEW);
    expect(audit.record).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({ action: 'BUSINESS_VERIFIED' }),
    );
  });

  it('requires a reason before rejecting a business', async () => {
    const prisma = { $transaction: jest.fn() };
    const service = new BusinessesService(
      prisma as unknown as PrismaService,
      {} as BusinessAccessService,
      audit as unknown as AuditService,
    );

    await expect(
      service.review(moderator, 'a8b1aeb7-5f38-47f9-9c25-b10e8d41d44e', {
        status: BusinessStatus.REJECTED,
      }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'BUSINESS_STATUS_REASON_REQUIRED' },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
