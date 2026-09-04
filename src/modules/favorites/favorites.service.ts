import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async addBusiness(userId: string, businessId: string) {
    await this.requirePublicBusiness(businessId);

    const favorite = await this.prisma.favoriteBusiness.upsert({
      where: { userId_businessId: { userId, businessId } },
      create: { userId, businessId },
      update: {},
      include: { business: true },
    });

    return this.toResponse(favorite);
  }

  async removeBusiness(userId: string, businessId: string) {
    await this.prisma.favoriteBusiness.deleteMany({
      where: { userId, businessId },
    });

    return { businessId, favorited: false };
  }

  async listBusinesses(userId: string, pagination: PaginationDto) {
    const where: Prisma.FavoriteBusinessWhereInput = {
      userId,
      business: { status: 'VERIFIED', deletedAt: null },
    };
    const [favorites, total] = await this.prisma.$transaction([
      this.prisma.favoriteBusiness.findMany({
        where,
        include: { business: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.favoriteBusiness.count({ where }),
    ]);

    return paginate(
      favorites.map((favorite) => this.toResponse(favorite)),
      total,
      pagination,
    );
  }

  private async requirePublicBusiness(businessId: string) {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, status: 'VERIFIED', deletedAt: null },
      select: { id: true },
    });
    if (!business) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'BUSINESS_NOT_FOUND',
        'Business not found',
      );
    }
  }

  private toResponse(favorite: {
    id: string;
    businessId: string;
    createdAt: Date;
    business: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      type: string;
      status: string;
      verifiedAt: Date | null;
    };
  }) {
    return {
      id: favorite.id,
      businessId: favorite.businessId,
      favorited: true,
      createdAt: favorite.createdAt,
      business: {
        id: favorite.business.id,
        name: favorite.business.name,
        slug: favorite.business.slug,
        description: favorite.business.description,
        type: favorite.business.type,
        status: favorite.business.status,
        verifiedAt: favorite.business.verifiedAt,
      },
    };
  }
}
