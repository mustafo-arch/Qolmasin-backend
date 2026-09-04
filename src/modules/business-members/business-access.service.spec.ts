import { BusinessAccessService } from './business-access.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

describe('BusinessAccessService', () => {
  it('hides a business when the user has no membership', async () => {
    const prisma = {
      businessMember: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new BusinessAccessService(
      prisma as unknown as PrismaService,
    );

    await expect(
      service.requireManager('user-id', 'business-id'),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it('blocks all mutations for a suspended business', async () => {
    const prisma = {
      businessMember: {
        findUnique: jest.fn().mockResolvedValue({
          role: 'OWNER',
          status: 'ACTIVE',
          business: { status: 'SUSPENDED', deletedAt: null },
        }),
      },
    };
    const service = new BusinessAccessService(
      prisma as unknown as PrismaService,
    );

    await expect(
      service.requireOwner('user-id', 'business-id'),
    ).rejects.toMatchObject({
      status: 403,
    });
  });
});
