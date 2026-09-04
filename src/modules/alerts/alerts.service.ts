import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateDealAlertDto } from './dto/create-deal-alert.dto';
import { UpdateDealAlertDto } from './dto/update-deal-alert.dto';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateDealAlertDto) {
    const values = await this.normalize(dto);
    const alert = await this.prisma.dealAlert.create({
      data: {
        userId,
        latitude: values.latitude,
        longitude: values.longitude,
        categoryId: values.categoryId,
        productQuery: values.productQuery,
        radius: values.radius,
        minDiscount: values.minDiscount,
        maxPrice: values.maxPrice,
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    return this.toResponse(alert);
  }

  async list(userId: string, query: PaginationDto) {
    const where: Prisma.DealAlertWhereInput = { userId };
    const [alerts, total] = await this.prisma.$transaction([
      this.prisma.dealAlert.findMany({
        where,
        include: { category: { select: { id: true, name: true, slug: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.dealAlert.count({ where }),
    ]);
    return paginate(
      alerts.map((alert) => this.toResponse(alert)),
      total,
      query,
    );
  }

  async update(userId: string, alertId: string, dto: UpdateDealAlertDto) {
    const existing = await this.prisma.dealAlert.findFirst({
      where: { id: alertId, userId },
    });
    if (!existing) throw this.notFound();

    const values = await this.normalize({
      latitude: dto.latitude ?? Number(existing.latitude),
      longitude: dto.longitude ?? Number(existing.longitude),
      categoryId: dto.categoryId ?? existing.categoryId ?? undefined,
      productQuery: dto.productQuery ?? existing.productQuery ?? undefined,
      radius: dto.radius ?? Number(existing.radius),
      minDiscount:
        dto.minDiscount ??
        (existing.minDiscount === null
          ? undefined
          : Number(existing.minDiscount)),
      maxPrice:
        dto.maxPrice ??
        (existing.maxPrice === null ? undefined : Number(existing.maxPrice)),
    });
    const alert = await this.prisma.dealAlert.update({
      where: { id: alertId },
      data: {
        latitude: values.latitude,
        longitude: values.longitude,
        categoryId: values.categoryId,
        productQuery: values.productQuery,
        radius: values.radius,
        minDiscount: values.minDiscount,
        maxPrice: values.maxPrice,
        enabled: dto.enabled,
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    return this.toResponse(alert);
  }

  async remove(userId: string, alertId: string) {
    const deleted = await this.prisma.dealAlert.deleteMany({
      where: { id: alertId, userId },
    });
    if (deleted.count !== 1) throw this.notFound();
    return { id: alertId, deleted: true };
  }

  private async normalize(input: {
    latitude: number;
    longitude: number;
    categoryId?: string;
    productQuery?: string;
    radius?: number;
    minDiscount?: number;
    maxPrice?: number;
  }) {
    const productQuery = input.productQuery?.trim() || undefined;
    if (!input.categoryId && !productQuery) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'DEAL_ALERT_FILTER_REQUIRED',
        'A category or product search is required',
      );
    }
    if (input.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: input.categoryId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!category) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          'DEAL_ALERT_CATEGORY_INVALID',
          'Only an active category can be used in a deal alert',
        );
      }
    }
    return {
      latitude: new Prisma.Decimal(input.latitude),
      longitude: new Prisma.Decimal(input.longitude),
      categoryId: input.categoryId,
      productQuery,
      radius: new Prisma.Decimal(input.radius ?? 3),
      minDiscount:
        input.minDiscount === undefined
          ? undefined
          : new Prisma.Decimal(input.minDiscount),
      maxPrice:
        input.maxPrice === undefined
          ? undefined
          : new Prisma.Decimal(input.maxPrice),
    };
  }

  private toResponse(alert: {
    id: string;
    categoryId: string | null;
    productQuery: string | null;
    latitude: Prisma.Decimal;
    longitude: Prisma.Decimal;
    radius: Prisma.Decimal;
    minDiscount: Prisma.Decimal | null;
    maxPrice: Prisma.Decimal | null;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
    category?: { id: string; name: string; slug: string } | null;
  }) {
    return {
      id: alert.id,
      categoryId: alert.categoryId,
      category: alert.category ?? null,
      productQuery: alert.productQuery,
      latitude: Number(alert.latitude.toFixed(6)),
      longitude: Number(alert.longitude.toFixed(6)),
      radiusKm: Number(alert.radius.toFixed(2)),
      minDiscount: alert.minDiscount?.toFixed(2) ?? null,
      maxPrice: alert.maxPrice?.toFixed(2) ?? null,
      enabled: alert.enabled,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
    };
  }

  private notFound() {
    return new AppException(
      HttpStatus.NOT_FOUND,
      'DEAL_ALERT_NOT_FOUND',
      'Deal alert not found',
    );
  }
}
