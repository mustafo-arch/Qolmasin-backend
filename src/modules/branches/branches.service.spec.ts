import { BranchStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { BusinessAccessService } from '../business-members/business-access.service';
import { BranchesService } from './branches.service';

const baseDto = {
  name: 'Main branch',
  address: 'Example street 1',
  countryCode: 'UZ',
  city: 'Tashkent',
  latitude: 41.3,
  longitude: 69.2,
  timezone: 'Asia/Tashkent',
  currency: 'UZS',
};

describe('BranchesService', () => {
  const access = {
    requireManager: jest.fn().mockResolvedValue({}),
  };

  it('rejects an invalid IANA timezone', async () => {
    const prisma = { branch: { create: jest.fn() } };
    const service = new BranchesService(
      prisma as unknown as PrismaService,
      access as unknown as BusinessAccessService,
    );

    await expect(
      service.create('user-id', 'business-id', {
        ...baseDto,
        timezone: 'Invalid/Timezone',
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.branch.create).not.toHaveBeenCalled();
  });

  it('accepts valid coordinates and maps decimals safely', async () => {
    const now = new Date();
    const prisma = {
      branch: {
        create: jest.fn().mockResolvedValue({
          id: 'eb14f69e-44af-4300-8d64-31b2baa4c026',
          businessId: 'ecbe2475-3ad1-4506-8104-f2dff9ba239d',
          ...baseDto,
          latitude: new Prisma.Decimal(baseDto.latitude),
          longitude: new Prisma.Decimal(baseDto.longitude),
          region: null,
          district: null,
          phone: null,
          status: BranchStatus.ACTIVE,
          openingTime: null,
          closingTime: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        }),
      },
    };
    const service = new BranchesService(
      prisma as unknown as PrismaService,
      access as unknown as BusinessAccessService,
    );

    const result = await service.create('user-id', 'business-id', baseDto);

    expect(result.latitude).toBe(baseDto.latitude);
    expect(result.longitude).toBe(baseDto.longitude);
  });
});
