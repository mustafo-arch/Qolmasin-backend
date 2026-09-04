import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { BusinessAccessService } from '../business-members/business-access.service';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  it('does not activate a product for an unverified business', async () => {
    const prisma = {
      product: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'product-id',
          businessId: 'business-id',
          categoryId: 'category-id',
          status: ProductStatus.DRAFT,
          deletedAt: null,
        }),
        update: jest.fn(),
      },
      category: {
        findFirst: jest.fn().mockResolvedValue({ id: 'category-id' }),
      },
    };
    const access = {
      requireManager: jest.fn().mockResolvedValue({
        business: { status: 'DRAFT' },
      }),
    };
    const service = new ProductsService(
      prisma as unknown as PrismaService,
      access as unknown as BusinessAccessService,
    );

    await expect(
      service.update('user-id', 'business-id', 'product-id', {
        status: ProductStatus.ACTIVE,
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('treats archived products as terminal', async () => {
    const prisma = {
      product: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'product-id',
          businessId: 'business-id',
          categoryId: 'category-id',
          status: ProductStatus.ARCHIVED,
          deletedAt: null,
        }),
        update: jest.fn(),
      },
    };
    const access = {
      requireManager: jest.fn().mockResolvedValue({
        business: { status: 'VERIFIED' },
      }),
    };
    const service = new ProductsService(
      prisma as unknown as PrismaService,
      access as unknown as BusinessAccessService,
    );

    await expect(
      service.update('user-id', 'business-id', 'product-id', {
        status: ProductStatus.ACTIVE,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
