import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  it('creates a favorite for a verified business', async () => {
    const favorite = {
      id: 'favorite-id',
      businessId: 'business-id',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      business: {
        id: 'business-id',
        name: 'Test business',
        slug: 'test-business',
        description: null,
        type: 'CAFE',
        status: 'VERIFIED',
        verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    };
    const prisma = {
      business: {
        findFirst: jest.fn().mockResolvedValue({ id: 'business-id' }),
      },
      favoriteBusiness: {
        upsert: jest.fn().mockResolvedValue(favorite),
      },
    };
    const service = new FavoritesService(prisma as unknown as PrismaService);

    await expect(
      service.addBusiness('user-id', 'business-id'),
    ).resolves.toMatchObject({
      businessId: 'business-id',
      favorited: true,
    });
    expect(prisma.favoriteBusiness.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_businessId: { userId: 'user-id', businessId: 'business-id' },
        },
        create: { userId: 'user-id', businessId: 'business-id' },
      }),
    );
  });

  it('does not allow favoriting a non-public business', async () => {
    const prisma = {
      business: { findFirst: jest.fn().mockResolvedValue(null) },
      favoriteBusiness: { upsert: jest.fn() },
    };
    const service = new FavoritesService(prisma as unknown as PrismaService);

    await expect(
      service.addBusiness('user-id', 'business-id'),
    ).rejects.toMatchObject({
      response: { code: 'BUSINESS_NOT_FOUND' },
      status: 404,
    });
    expect(prisma.favoriteBusiness.upsert).not.toHaveBeenCalled();
  });

  it('removes a favorite idempotently', async () => {
    const prisma = {
      favoriteBusiness: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const service = new FavoritesService(prisma as unknown as PrismaService);

    await expect(
      service.removeBusiness('user-id', 'business-id'),
    ).resolves.toEqual({ businessId: 'business-id', favorited: false });
  });
});
