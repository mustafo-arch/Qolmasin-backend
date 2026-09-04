import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Offer, OfferStatus, OfferType, Prisma } from '@prisma/client';
import { RequestContextData } from '../../common/decorators/request-context.decorator';
import { paginate } from '../../common/dto/pagination.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditAction, AuditEntityType } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { BusinessAccessService } from '../business-members/business-access.service';
import { BusinessPermission } from '../business-members/business-permission.enum';
import { CreateDiscountScheduleDto } from './dto/create-discount-schedule.dto';
import { CreateOfferDto } from './dto/create-offer.dto';
import { CreateQuickOfferDto } from './dto/create-quick-offer.dto';
import { ListOffersDto } from './dto/list-offers.dto';
import { NearbyOffersDto } from './dto/nearby-offers.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';

interface NearbyOfferRow {
  id: string;
  branchId: string;
  productId: string;
  productName: string;
  businessId: string;
  businessName: string;
  branchName: string;
  city: string;
  currency: string;
  originalPrice: Prisma.Decimal;
  regularPrice: Prisma.Decimal;
  discountPrice: Prisma.Decimal;
  quantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  pickupStart: Date;
  pickupEnd: Date;
  expiresAt: Date;
  publishedAt: Date | null;
  status: OfferStatus;
  offerType: string;
  imageUrl: string | null;
  businessType: string;
  quantityUnit: string;
  distanceKm: number;
  discountPercent: number;
  totalCount: bigint;
}

@Injectable()
export class OffersService {
  private readonly lowStockThreshold: number;
  private readonly maxRadiusKm: number;
  private readonly priceIncreaseAlertPercent: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BusinessAccessService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.lowStockThreshold = config.get<number>('LOW_STOCK_THRESHOLD', 3);
    this.maxRadiusKm = config.get<number>('NEARBY_MAX_RADIUS_KM', 50);
    this.priceIncreaseAlertPercent = config.get<number>(
      'PRICE_INCREASE_ALERT_PERCENT',
      40,
    );
  }

  async create(
    actor: AuthenticatedUser,
    businessId: string,
    dto: CreateOfferDto,
    context: RequestContextData = {},
  ) {
    await this.access.requireManager(
      actor.sub,
      businessId,
      BusinessPermission.OFFER_WRITE,
    );
    const domain = await this.requireDomain(
      businessId,
      dto.branchId,
      dto.productId,
    );
    const values = this.validateValues(dto, domain.regularPrice);
    const offer = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.offer.create({
        data: {
          branchId: domain.branchId,
          productId: domain.productId,
          originalPrice: values.originalPrice,
          discountPrice: values.discountPrice,
          referencePrice: values.referencePrice,
          offerType: values.offerType,
          quantity: dto.quantity,
          pickupStart: values.pickupStart,
          pickupEnd: values.pickupEnd,
          expiresAt: values.expiresAt,
          bestBeforeAt: values.bestBeforeAt,
          preparedAt: values.preparedAt,
        },
      });
      await this.recordPriceObservation(transaction, {
        actorUserId: actor.sub,
        actorRole: actor.role,
        requestId: context.requestId,
        ip: context.ip,
        offerId: created.id,
        productId: created.productId,
        branchId: created.branchId,
        price: created.originalPrice,
        source: 'OFFER_CREATED',
      });
      await this.audit.record(transaction, {
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: AuditAction.OFFER_CREATED,
        entityType: AuditEntityType.OFFER,
        entityId: created.id,
        requestId: context.requestId,
        ip: context.ip,
        metadata: { businessId, quantity: created.quantity },
      });
      return created;
    });
    return this.toResponse(offer, domain.currency);
  }

  async createQuick(
    actor: AuthenticatedUser,
    businessId: string,
    dto: CreateQuickOfferDto,
    context: RequestContextData = {},
  ) {
    const now = new Date();
    const domain = await this.requireDomain(
      businessId,
      dto.branchId,
      dto.productId,
    );
    const pickupEnd = new Date(
      now.getTime() + dto.durationMinutes * 60 * 1_000,
    );
    return this.create(
      actor,
      businessId,
      {
        branchId: dto.branchId,
        productId: dto.productId,
        originalPrice: domain.regularPrice?.toString() ?? dto.discountPrice,
        discountPrice: dto.discountPrice,
        offerType: dto.offerType,
        quantity: dto.quantity,
        pickupStart: now.toISOString(),
        pickupEnd: pickupEnd.toISOString(),
        expiresAt: pickupEnd.toISOString(),
        bestBeforeAt: dto.bestBeforeAt,
      },
      context,
    );
  }

  async addDiscountSchedule(
    actor: AuthenticatedUser,
    businessId: string,
    offerId: string,
    dto: CreateDiscountScheduleDto,
    context: RequestContextData = {},
  ) {
    await this.access.requireManager(
      actor.sub,
      businessId,
      BusinessPermission.OFFER_WRITE,
    );
    const offer = await this.findManaged(businessId, offerId);
    const startsAt = new Date(dto.startsAt);
    const price = new Prisma.Decimal(dto.price);
    if (
      price.isNegative() ||
      price.greaterThan(offer.referencePrice ?? offer.originalPrice) ||
      startsAt < new Date() ||
      startsAt >= offer.pickupEnd
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'DISCOUNT_SCHEDULE_INVALID',
        'Scheduled price and time must be valid and within the pickup window',
      );
    }
    const schedule = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.discountSchedule.create({
        data: { offerId, startsAt, price },
      });
      await transaction.offer.update({
        where: { id: offerId },
        data: { autoDiscountEnabled: true },
      });
      await this.audit.record(transaction, {
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: AuditAction.OFFER_UPDATED,
        entityType: AuditEntityType.OFFER,
        entityId: offerId,
        requestId: context.requestId,
        ip: context.ip,
        metadata: {
          discountScheduleId: created.id,
          startsAt,
          price: dto.price,
        },
      });
      return created;
    });
    return {
      id: schedule.id,
      offerId: schedule.offerId,
      startsAt: schedule.startsAt,
      price: schedule.price.toFixed(2),
    };
  }

  async update(
    actor: AuthenticatedUser,
    businessId: string,
    offerId: string,
    dto: UpdateOfferDto,
    context: RequestContextData = {},
  ) {
    await this.access.requireManager(
      actor.sub,
      businessId,
      BusinessPermission.OFFER_WRITE,
    );
    const existing = await this.findManaged(businessId, offerId);
    if (existing.status !== OfferStatus.DRAFT) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'OFFER_NOT_EDITABLE',
        'Only a draft offer can be edited',
      );
    }
    const values = this.validateValues(
      {
        originalPrice: dto.originalPrice ?? existing.originalPrice.toString(),
        discountPrice: dto.discountPrice ?? existing.discountPrice.toString(),
        quantity: dto.quantity ?? existing.quantity,
        pickupStart: dto.pickupStart ?? existing.pickupStart.toISOString(),
        pickupEnd: dto.pickupEnd ?? existing.pickupEnd.toISOString(),
        expiresAt: dto.expiresAt ?? existing.expiresAt.toISOString(),
        referencePrice:
          dto.referencePrice ?? existing.referencePrice?.toString(),
        offerType: dto.offerType ?? existing.offerType,
        bestBeforeAt: dto.bestBeforeAt ?? existing.bestBeforeAt?.toISOString(),
        preparedAt: dto.preparedAt ?? existing.preparedAt?.toISOString(),
      },
      existing.product.regularPrice,
    );
    const offer = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.offer.update({
        where: { id: offerId },
        data: {
          originalPrice: dto.originalPrice ? values.originalPrice : undefined,
          discountPrice: dto.discountPrice ? values.discountPrice : undefined,
          referencePrice:
            dto.referencePrice !== undefined
              ? values.referencePrice
              : undefined,
          offerType: dto.offerType,
          quantity: dto.quantity,
          pickupStart: dto.pickupStart ? values.pickupStart : undefined,
          pickupEnd: dto.pickupEnd ? values.pickupEnd : undefined,
          expiresAt:
            dto.expiresAt || dto.pickupEnd ? values.expiresAt : undefined,
          bestBeforeAt:
            dto.bestBeforeAt !== undefined ? values.bestBeforeAt : undefined,
          preparedAt:
            dto.preparedAt !== undefined ? values.preparedAt : undefined,
        },
      });
      if (dto.originalPrice !== undefined) {
        await this.recordPriceObservation(transaction, {
          actorUserId: actor.sub,
          actorRole: actor.role,
          requestId: context.requestId,
          ip: context.ip,
          offerId: updated.id,
          productId: updated.productId,
          branchId: updated.branchId,
          price: updated.originalPrice,
          source: 'OFFER_UPDATED',
        });
      }
      await this.audit.record(transaction, {
        actorUserId: actor.sub,
        actorRole: actor.role,
        action:
          dto.originalPrice !== undefined ||
          dto.discountPrice !== undefined ||
          dto.referencePrice !== undefined
            ? AuditAction.OFFER_PRICE_CHANGED
            : AuditAction.OFFER_UPDATED,
        entityType: AuditEntityType.OFFER,
        entityId: offerId,
        requestId: context.requestId,
        ip: context.ip,
        metadata: {
          changedFields: Object.keys(dto).filter(
            (key) => dto[key as keyof UpdateOfferDto] !== undefined,
          ),
        },
      });
      return updated;
    });
    return this.toResponse(offer, existing.branch.currency);
  }

  async publish(
    actor: AuthenticatedUser,
    businessId: string,
    offerId: string,
    context: RequestContextData = {},
  ) {
    const member = await this.access.requireManager(
      actor.sub,
      businessId,
      BusinessPermission.OFFER_WRITE,
    );
    const existing = await this.findManaged(businessId, offerId);
    if (
      member.business.status !== 'VERIFIED' ||
      existing.branch.status !== 'ACTIVE' ||
      existing.product.status !== 'ACTIVE' ||
      existing.product.category.status !== 'ACTIVE'
    ) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'OFFER_PUBLISH_REQUIREMENTS_NOT_MET',
        'Verified business, active branch, product, and category are required',
      );
    }
    if (
      existing.status !== OfferStatus.DRAFT ||
      existing.expiresAt <= new Date()
    ) {
      throw this.invalidTransition();
    }
    const nextStatus =
      existing.quantity <= this.lowStockThreshold
        ? OfferStatus.LOW_STOCK
        : OfferStatus.ACTIVE;
    const now = new Date();
    const offer = await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.offer.updateMany({
        where: { id: offerId, status: OfferStatus.DRAFT },
        data: { status: nextStatus, publishedAt: now },
      });
      if (changed.count !== 1) throw this.invalidTransition();
      await this.audit.record(transaction, {
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: AuditAction.OFFER_PUBLISHED,
        entityType: AuditEntityType.OFFER,
        entityId: offerId,
        requestId: context.requestId,
        ip: context.ip,
        metadata: { quantity: existing.quantity },
      });
      const favoriteUsers = await transaction.favoriteBusiness.findMany({
        where: { businessId: existing.branch.businessId },
        select: { userId: true },
      });
      if (favoriteUsers.length > 0) {
        await transaction.notification.createMany({
          data: favoriteUsers.map(({ userId }) => ({
            userId,
            type: 'FAVORITE_BUSINESS_NEW_OFFER',
            title: 'New offer from a favorite business',
            message: `${existing.product.name} is now available for pickup`,
            data: { offerId, businessId },
          })),
        });
      }
      await this.notifyMatchingDealAlerts(transaction, {
        offerId,
        businessId,
        productName: existing.product.name,
        categoryId: existing.product.categoryId,
        latitude: Number(existing.branch.latitude),
        longitude: Number(existing.branch.longitude),
        regularPrice: existing.referencePrice ?? existing.originalPrice,
        salePrice: existing.discountPrice,
      });
      return transaction.offer.findUniqueOrThrow({ where: { id: offerId } });
    });
    return this.toResponse(offer, existing.branch.currency);
  }

  async cancel(
    actor: AuthenticatedUser,
    businessId: string,
    offerId: string,
    context: RequestContextData = {},
  ) {
    await this.access.requireManager(
      actor.sub,
      businessId,
      BusinessPermission.OFFER_WRITE,
    );
    const existing = await this.findManaged(businessId, offerId);
    if (
      existing.status === OfferStatus.CANCELLED ||
      existing.status === OfferStatus.EXPIRED
    ) {
      throw this.invalidTransition();
    }
    if (existing.reservedQuantity > 0) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'OFFER_HAS_ACTIVE_RESERVATIONS',
        'An offer with active reservations cannot be cancelled',
      );
    }
    const offer = await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.offer.updateMany({
        where: { id: offerId, status: existing.status },
        data: { status: OfferStatus.CANCELLED },
      });
      if (changed.count !== 1) throw this.invalidTransition();
      await this.audit.record(transaction, {
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: AuditAction.OFFER_CANCELLED,
        entityType: AuditEntityType.OFFER,
        entityId: offerId,
        requestId: context.requestId,
        ip: context.ip,
        metadata: { fromStatus: existing.status },
      });
      return transaction.offer.findUniqueOrThrow({ where: { id: offerId } });
    });
    return this.toResponse(offer, existing.branch.currency);
  }

  async moderateVisibility(
    actor: AuthenticatedUser,
    offerId: string,
    hidden: boolean,
    context: RequestContextData = {},
  ) {
    const existing = await this.prisma.offer.findFirst({
      where: { id: offerId },
      include: { branch: true },
    });
    if (!existing) throw this.notFound();
    if (
      existing.status === OfferStatus.CANCELLED ||
      existing.status === OfferStatus.EXPIRED
    ) {
      throw this.invalidTransition();
    }
    const nextStatus = hidden
      ? OfferStatus.HIDDEN
      : existing.quantity - existing.reservedQuantity - existing.soldQuantity <=
          this.lowStockThreshold
        ? OfferStatus.LOW_STOCK
        : OfferStatus.ACTIVE;
    const changed = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.offer.updateMany({
        where: { id: offerId, status: existing.status },
        data: { status: nextStatus },
      });
      if (updated.count !== 1) throw this.invalidTransition();
      await this.audit.record(transaction, {
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: hidden ? AuditAction.OFFER_HIDDEN : AuditAction.OFFER_UNHIDDEN,
        entityType: AuditEntityType.OFFER,
        entityId: offerId,
        requestId: context.requestId,
        ip: context.ip,
        metadata: { fromStatus: existing.status, toStatus: nextStatus },
      });
      return transaction.offer.findUniqueOrThrow({ where: { id: offerId } });
    });
    return this.toResponse(changed, existing.branch.currency);
  }

  async listManaged(userId: string, businessId: string, query: ListOffersDto) {
    await this.access.requireMembership(userId, businessId);
    await this.expireOffers();
    const where: Prisma.OfferWhereInput = {
      branchId: query.branchId,
      status: query.status,
      branch: { businessId },
      product: { categoryId: query.categoryId },
    };
    const [offers, total] = await this.prisma.$transaction([
      this.prisma.offer.findMany({
        where,
        include: { branch: { select: { currency: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.offer.count({ where }),
    ]);
    return paginate(
      offers.map((offer) => this.toResponse(offer, offer.branch.currency)),
      total,
      query,
    );
  }

  async listPublic(query: ListOffersDto) {
    await this.expireOffers();
    const now = new Date();
    const endingSoonUntil = new Date(now.getTime() + 24 * 60 * 60 * 1_000);
    const where: Prisma.OfferWhereInput = {
      branchId: query.branchId,
      status: { in: [OfferStatus.ACTIVE, OfferStatus.LOW_STOCK] },
      expiresAt: { gt: now },
      pickupEnd:
        query.endingSoon || query.expiresSoon
          ? { gt: now, lte: endingSoonUntil }
          : { gt: now },
      branch: {
        status: 'ACTIVE',
        deletedAt: null,
        business: {
          status: 'VERIFIED',
          deletedAt: null,
          type: query.businessType,
        },
      },
      product: {
        status: 'ACTIVE',
        deletedAt: null,
        categoryId: query.categoryId,
        category: { status: 'ACTIVE' },
      },
    };
    if (query.maxPrice !== undefined) {
      where.discountPrice = { lte: query.maxPrice };
    }
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { product: { name: { contains: search, mode: 'insensitive' } } },
        {
          branch: {
            business: { name: { contains: search, mode: 'insensitive' } },
          },
        },
      ];
    }
    const orderBy: Prisma.OfferOrderByWithRelationInput[] =
      query.sort === 'discount' || query.sort === 'price'
        ? [{ discountPrice: 'asc' }, { expiresAt: 'asc' }]
        : query.sort === 'newest'
          ? [{ publishedAt: 'desc' }, { id: 'desc' }]
          : query.sort === 'popular'
            ? [{ soldQuantity: 'desc' }, { expiresAt: 'asc' }]
            : [{ expiresAt: 'asc' }, { id: 'asc' }];
    const [offers, total] = await this.prisma.$transaction([
      this.prisma.offer.findMany({
        where,
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
              district: true,
              latitude: true,
              longitude: true,
              phone: true,
              timezone: true,
              openingTime: true,
              closingTime: true,
              currency: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              quantityUnit: true,
              regularPrice: true,
              images: { orderBy: { sortOrder: 'asc' }, take: 1 },
            },
          },
          discountSchedules: {
            where: { startsAt: { lte: now } },
            orderBy: { startsAt: 'desc' },
            take: 1,
          },
        },
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.offer.count({ where }),
    ]);
    return paginate(
      offers.map((offer) => ({
        ...this.toResponse(
          offer,
          offer.branch.currency,
          offer.discountSchedules[0]?.price,
        ),
        branch: offer.branch,
        product: {
          id: offer.product.id,
          name: offer.product.name,
          quantityUnit: offer.product.quantityUnit,
          regularPrice: offer.product.regularPrice?.toFixed(2) ?? null,
          imageUrl: offer.product.images[0]?.url ?? null,
        },
      })),
      total,
      query,
    );
  }

  async getPublic(offerId: string) {
    const result = await this.prisma.offer.findFirst({
      where: {
        id: offerId,
        status: { in: [OfferStatus.ACTIVE, OfferStatus.LOW_STOCK] },
        expiresAt: { gt: new Date() },
        pickupEnd: { gt: new Date() },
        branch: {
          status: 'ACTIVE',
          deletedAt: null,
          business: { status: 'VERIFIED', deletedAt: null },
        },
        product: {
          status: 'ACTIVE',
          deletedAt: null,
          category: { status: 'ACTIVE' },
        },
      },
      include: {
        branch: {
          include: {
            business: { select: { id: true, name: true, slug: true } },
          },
        },
        product: { include: { images: { orderBy: { sortOrder: 'asc' } } } },
        discountSchedules: {
          where: { startsAt: { lte: new Date() } },
          orderBy: { startsAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!result) throw this.notFound();
    return {
      ...this.toResponse(
        result,
        result.branch.currency,
        result.discountSchedules[0]?.price,
      ),
      branch: result.branch,
      product: result.product,
    };
  }

  async getPublicPriceHistory(offerId: string) {
    const offer = await this.prisma.offer.findFirst({
      where: {
        id: offerId,
        status: { in: [OfferStatus.ACTIVE, OfferStatus.LOW_STOCK] },
        expiresAt: { gt: new Date() },
        pickupEnd: { gt: new Date() },
        branch: {
          status: 'ACTIVE',
          deletedAt: null,
          business: { status: 'VERIFIED', deletedAt: null },
        },
        product: { status: 'ACTIVE', deletedAt: null },
      },
      select: { id: true, productId: true, branchId: true },
    });
    if (!offer) throw this.notFound();
    const history = await this.prisma.priceHistory.findMany({
      where: {
        productId: offer.productId,
        branchId: offer.branchId,
        recordedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1_000) },
      },
      orderBy: { recordedAt: 'asc' },
      select: { price: true, source: true, recordedAt: true },
    });
    return {
      offerId: offer.id,
      data: history.map((item) => ({
        price: item.price.toFixed(2),
        source: item.source,
        recordedAt: item.recordedAt,
      })),
    };
  }

  async nearby(query: NearbyOffersDto) {
    if (query.radius > this.maxRadiusKm) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'NEARBY_RADIUS_TOO_LARGE',
        `Radius cannot exceed ${this.maxRadiusKm} km`,
      );
    }
    await this.expireOffers();
    const categoryFilter = query.categoryId
      ? Prisma.sql`AND p."category_id" = ${query.categoryId}::uuid`
      : Prisma.empty;
    const businessTypeFilter = query.businessType
      ? Prisma.sql`AND biz."type" = ${query.businessType}::"BusinessType"`
      : Prisma.empty;
    const maxPriceFilter =
      query.maxPrice !== undefined
        ? Prisma.sql`AND "discountPrice" <= ${query.maxPrice}`
        : Prisma.empty;
    const endingSoonFilter =
      query.endingSoon || query.expiresSoon
        ? Prisma.sql`AND "pickupEnd" <= ${new Date(Date.now() + 24 * 60 * 60 * 1_000)}`
        : Prisma.empty;
    const searchFilter = query.search?.trim()
      ? Prisma.sql`AND (p.name ILIKE ${`%${query.search.trim()}%`} OR biz.name ILIKE ${`%${query.search.trim()}%`})`
      : Prisma.empty;
    const orderBy = {
      distance: Prisma.sql`"distanceKm" ASC`,
      discount: Prisma.sql`"discountPercent" DESC`,
      price: Prisma.sql`"discountPrice" ASC`,
      expires: Prisma.sql`"expiresAt" ASC`,
      popular: Prisma.sql`"soldQuantity" DESC`,
      newest: Prisma.sql`"publishedAt" DESC`,
    }[query.sort];
    const offset = (query.page - 1) * query.limit;
    const rows = await this.prisma.$queryRaw<NearbyOfferRow[]>(Prisma.sql`
      WITH nearby AS (
        SELECT
          o.id,
          o."branch_id" AS "branchId",
          o."product_id" AS "productId",
          p.name AS "productName",
          b."business_id" AS "businessId",
          biz.name AS "businessName",
          b.name AS "branchName",
          b.city,
          b.currency,
          biz."type" AS "businessType",
          p."quantity_unit" AS "quantityUnit",
          o."original_price" AS "originalPrice",
          COALESCE((
            SELECT ds.price
            FROM "discount_schedules" ds
            WHERE ds."offer_id" = o.id AND ds."starts_at" <= NOW()
            ORDER BY ds."starts_at" DESC
            LIMIT 1
          ), o."discount_price") AS "discountPrice",
          COALESCE(o."reference_price", o."original_price") AS "regularPrice",
          o.quantity,
          o."reserved_quantity" AS "reservedQuantity",
          o."sold_quantity" AS "soldQuantity",
          o."pickup_start" AS "pickupStart",
          o."pickup_end" AS "pickupEnd",
          o."expires_at" AS "expiresAt",
          o."published_at" AS "publishedAt",
          o.status,
          o."offer_type" AS "offerType",
          (SELECT pi.url FROM "product_images" pi WHERE pi."product_id" = p.id ORDER BY pi."sort_order", pi.id LIMIT 1) AS "imageUrl",
          (6371 * acos(LEAST(1, GREATEST(-1,
            cos(radians(${query.lat})) * cos(radians(b.latitude::double precision)) *
            cos(radians(b.longitude::double precision) - radians(${query.lng})) +
            sin(radians(${query.lat})) * sin(radians(b.latitude::double precision))
          )))) AS "distanceKm",
          CASE WHEN COALESCE(o."reference_price", o."original_price") = 0 THEN 0 ELSE
            ((COALESCE(o."reference_price", o."original_price") - COALESCE((
              SELECT ds.price
              FROM "discount_schedules" ds
              WHERE ds."offer_id" = o.id AND ds."starts_at" <= NOW()
              ORDER BY ds."starts_at" DESC
              LIMIT 1
            ), o."discount_price")) / COALESCE(o."reference_price", o."original_price") * 100)::double precision
          END AS "discountPercent"
        FROM "offers" o
        JOIN "branches" b ON b.id = o."branch_id"
        JOIN "businesses" biz ON biz.id = b."business_id"
        JOIN "products" p ON p.id = o."product_id"
        JOIN "categories" c ON c.id = p."category_id"
        WHERE o.status IN ('ACTIVE'::"OfferStatus", 'LOW_STOCK'::"OfferStatus")
          AND o."expires_at" > NOW()
          AND o."pickup_end" > NOW()
          AND b.status = 'ACTIVE'::"BranchStatus" AND b."deleted_at" IS NULL
          AND biz.status = 'VERIFIED'::"BusinessStatus" AND biz."deleted_at" IS NULL
          AND p.status = 'ACTIVE'::"ProductStatus" AND p."deleted_at" IS NULL
          AND c.status = 'ACTIVE'::"CategoryStatus"
          ${categoryFilter}
          ${businessTypeFilter}
          ${searchFilter}
      )
      SELECT *, COUNT(*) OVER() AS "totalCount"
      FROM nearby
      WHERE "distanceKm" <= ${query.radius}
        AND "discountPercent" >= ${query.minDiscount}
        AND quantity - "reservedQuantity" - "soldQuantity" > 0
        ${maxPriceFilter}
        ${endingSoonFilter}
      ORDER BY ${orderBy}, id ASC
      LIMIT ${query.limit} OFFSET ${offset}
    `);
    const total = rows[0] ? Number(rows[0].totalCount) : 0;
    return paginate(
      rows.map((row) => ({
        id: row.id,
        branchId: row.branchId,
        productId: row.productId,
        productName: row.productName,
        businessId: row.businessId,
        businessName: row.businessName,
        branchName: row.branchName,
        city: row.city,
        currency: row.currency,
        businessType: row.businessType,
        quantityUnit: row.quantityUnit,
        originalPrice: row.originalPrice.toFixed(2),
        regularPrice: row.regularPrice.toFixed(2),
        discountPrice: row.discountPrice.toFixed(2),
        salePrice: row.discountPrice.toFixed(2),
        availableQuantity:
          row.quantity - row.reservedQuantity - row.soldQuantity,
        pickupStart: row.pickupStart,
        pickupEnd: row.pickupEnd,
        expiresAt: row.expiresAt,
        badges: this.deriveNearbyBadges(row),
        status: row.status,
        offerType: row.offerType,
        offerTypeLabel: this.offerTypeLabel(row.offerType),
        imageUrl: row.imageUrl,
        distanceKm: Math.round(row.distanceKm * 100) / 100,
        discountPercent: Math.round(row.discountPercent * 100) / 100,
      })),
      total,
      query,
    );
  }

  private deriveNearbyBadges(row: NearbyOfferRow): string[] {
    const badges: string[] = [];
    const availableQuantity =
      row.quantity - row.reservedQuantity - row.soldQuantity;
    const now = Date.now();
    if (availableQuantity <= this.lowStockThreshold) badges.push('LOW_STOCK');
    if (row.pickupEnd.getTime() <= now + 24 * 60 * 60 * 1_000) {
      badges.push('ENDING_SOON');
    }
    if (
      row.publishedAt &&
      row.publishedAt.getTime() >= now - 24 * 60 * 60 * 1_000
    ) {
      badges.push('NEW');
    }
    if (row.soldQuantity >= 10) badges.push('POPULAR');
    if (
      !row.regularPrice.isZero() &&
      row.regularPrice.sub(row.discountPrice).div(row.regularPrice).gte(0.5)
    ) {
      badges.push('BEST_VALUE');
    }
    return badges;
  }

  private async findManaged(businessId: string, offerId: string) {
    const offer = await this.prisma.offer.findFirst({
      where: { id: offerId, branch: { businessId } },
      include: {
        branch: true,
        product: { include: { category: true } },
      },
    });
    if (!offer) throw this.notFound();
    return offer;
  }

  private async notifyMatchingDealAlerts(
    transaction: Prisma.TransactionClient,
    input: {
      offerId: string;
      businessId: string;
      productName: string;
      categoryId: string;
      latitude: number;
      longitude: number;
      regularPrice: Prisma.Decimal;
      salePrice: Prisma.Decimal;
    },
  ) {
    const alerts = await transaction.dealAlert.findMany({
      where: { enabled: true },
      select: {
        id: true,
        userId: true,
        categoryId: true,
        productQuery: true,
        latitude: true,
        longitude: true,
        radius: true,
        minDiscount: true,
        maxPrice: true,
      },
    });
    if (alerts.length === 0) return;

    const discountPercent = input.regularPrice.isZero()
      ? new Prisma.Decimal(0)
      : input.regularPrice
          .sub(input.salePrice)
          .div(input.regularPrice)
          .mul(100);
    const matchingByUser = new Map<string, string[]>();
    for (const alert of alerts) {
      if (alert.categoryId && alert.categoryId !== input.categoryId) continue;
      if (
        alert.productQuery &&
        !input.productName
          .toLocaleLowerCase()
          .includes(alert.productQuery.toLocaleLowerCase())
      ) {
        continue;
      }
      if (
        alert.minDiscount !== null &&
        discountPercent.lessThan(alert.minDiscount)
      ) {
        continue;
      }
      if (alert.maxPrice && input.salePrice.greaterThan(alert.maxPrice)) {
        continue;
      }
      const distanceKm = this.distanceKm(
        input.latitude,
        input.longitude,
        Number(alert.latitude),
        Number(alert.longitude),
      );
      if (distanceKm > Number(alert.radius)) continue;
      const userAlerts = matchingByUser.get(alert.userId) ?? [];
      userAlerts.push(alert.id);
      matchingByUser.set(alert.userId, userAlerts);
    }
    if (matchingByUser.size === 0) return;
    await transaction.notification.createMany({
      data: [...matchingByUser.entries()].map(([userId, alertIds]) => ({
        userId,
        type: 'DEAL_ALERT_MATCH',
        title: 'A deal matching your alert is available',
        message: `${input.productName} is now available nearby`,
        data: {
          offerId: input.offerId,
          businessId: input.businessId,
          alertIds,
        },
      })),
    });
  }

  private distanceKm(
    latitude: number,
    longitude: number,
    alertLatitude: number,
    alertLongitude: number,
  ) {
    const radians = Math.PI / 180;
    const deltaLatitude = (alertLatitude - latitude) * radians;
    const deltaLongitude = (alertLongitude - longitude) * radians;
    const a =
      Math.sin(deltaLatitude / 2) ** 2 +
      Math.cos(latitude * radians) *
        Math.cos(alertLatitude * radians) *
        Math.sin(deltaLongitude / 2) ** 2;
    return 6_371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private async requireDomain(
    businessId: string,
    branchId: string,
    productId: string,
  ) {
    const [branch, product] = await Promise.all([
      this.prisma.branch.findFirst({
        where: { id: branchId, businessId, deletedAt: null },
        select: { id: true, currency: true },
      }),
      this.prisma.product.findFirst({
        where: { id: productId, businessId, deletedAt: null },
        select: { id: true, regularPrice: true },
      }),
    ]);
    if (!branch || !product) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'OFFER_DOMAIN_INVALID',
        'Branch and product must belong to the same business',
      );
    }
    return {
      branchId: branch.id,
      productId: product.id,
      currency: branch.currency,
      regularPrice: product.regularPrice,
    };
  }

  private async recordPriceObservation(
    transaction: Prisma.TransactionClient,
    input: {
      actorUserId: string;
      actorRole: AuthenticatedUser['role'];
      requestId?: string;
      ip?: string;
      offerId: string;
      productId: string;
      branchId: string;
      price: Prisma.Decimal;
      source: string;
    },
  ): Promise<void> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000);
    const observations = await transaction.priceHistory.findMany({
      where: {
        productId: input.productId,
        branchId: input.branchId,
        recordedAt: { gte: since },
      },
      select: { price: true },
      orderBy: { recordedAt: 'desc' },
      take: 101,
    });
    await transaction.priceHistory.create({
      data: {
        productId: input.productId,
        branchId: input.branchId,
        price: input.price,
        source: input.source,
      },
    });
    if (observations.length === 0) return;

    const prices = observations
      .map((observation) => observation.price)
      .sort((left, right) => left.comparedTo(right));
    const middle = Math.floor(prices.length / 2);
    const median =
      prices.length % 2 === 0
        ? prices[middle - 1].add(prices[middle]).div(2)
        : prices[middle];
    if (median.isZero() || !input.price.greaterThan(median)) return;
    const increasePercent = input.price.sub(median).div(median).mul(100);
    if (!increasePercent.greaterThanOrEqualTo(this.priceIncreaseAlertPercent)) {
      return;
    }
    const anomaly = await transaction.priceAnomaly.create({
      data: {
        offerId: input.offerId,
        productId: input.productId,
        branchId: input.branchId,
        previousPrice: median,
        currentPrice: input.price,
        increasePercent,
        reason: `Price increased by ${increasePercent.toFixed(2)}% compared with the recent median`,
      },
    });
    await this.audit.record(transaction, {
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      action: AuditAction.PRICE_ANOMALY_CREATED,
      entityType: AuditEntityType.PRICE_ANOMALY,
      entityId: anomaly.id,
      requestId: input.requestId,
      ip: input.ip,
      metadata: {
        offerId: input.offerId,
        productId: input.productId,
        increasePercent: increasePercent.toFixed(2),
      },
    });
  }

  private validateValues(
    dto: {
      originalPrice: string;
      discountPrice: string;
      quantity: number;
      pickupStart: string;
      pickupEnd: string;
      expiresAt?: string;
      referencePrice?: string;
      offerType?: OfferType;
      bestBeforeAt?: string;
      preparedAt?: string;
    },
    productRegularPrice?: Prisma.Decimal | null,
  ) {
    const originalPrice = new Prisma.Decimal(dto.originalPrice);
    const discountPrice = new Prisma.Decimal(dto.discountPrice);
    const referencePrice =
      dto.referencePrice === undefined
        ? (productRegularPrice ?? undefined)
        : new Prisma.Decimal(dto.referencePrice);
    const maxMoney = new Prisma.Decimal('999999999999.99');
    if (
      productRegularPrice &&
      (originalPrice.greaterThan(productRegularPrice) ||
        (referencePrice !== undefined &&
          referencePrice.greaterThan(productRegularPrice)))
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'OFFER_REFERENCE_PRICE_INVALID',
        'Offer reference price cannot exceed the product regular price',
      );
    }
    if (
      originalPrice.isNegative() ||
      discountPrice.isNegative() ||
      discountPrice.greaterThan(originalPrice) ||
      (referencePrice !== undefined &&
        discountPrice.greaterThan(referencePrice)) ||
      originalPrice.greaterThan(maxMoney) ||
      (referencePrice !== undefined &&
        (referencePrice.isNegative() || referencePrice.greaterThan(maxMoney)))
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'OFFER_INVALID_PRICE',
        'Offer prices are invalid',
      );
    }
    const pickupStart = new Date(dto.pickupStart);
    const pickupEnd = new Date(dto.pickupEnd);
    const expiresAt = new Date(dto.expiresAt ?? dto.pickupEnd);
    const bestBeforeAt = dto.bestBeforeAt
      ? new Date(dto.bestBeforeAt)
      : undefined;
    const preparedAt = dto.preparedAt ? new Date(dto.preparedAt) : undefined;
    if (
      pickupStart >= pickupEnd ||
      expiresAt < pickupEnd ||
      expiresAt <= new Date() ||
      (bestBeforeAt !== undefined &&
        (bestBeforeAt <= new Date() || bestBeforeAt > expiresAt)) ||
      (preparedAt !== undefined && preparedAt > new Date())
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'OFFER_INVALID_TIME_WINDOW',
        'Offer pickup and expiry times are invalid',
      );
    }
    return {
      originalPrice,
      discountPrice,
      referencePrice,
      offerType: dto.offerType ?? OfferType.SURPLUS,
      pickupStart,
      pickupEnd,
      expiresAt,
      bestBeforeAt,
      preparedAt,
    };
  }

  private expireOffers() {
    return this.prisma.offer.updateMany({
      where: {
        status: {
          in: [OfferStatus.ACTIVE, OfferStatus.LOW_STOCK, OfferStatus.SOLD_OUT],
        },
        OR: [
          { expiresAt: { lte: new Date() } },
          { pickupEnd: { lte: new Date() } },
        ],
      },
      data: { status: OfferStatus.EXPIRED },
    });
  }

  private toResponse(
    offer: Offer,
    currency: string,
    effectiveDiscountPrice?: Prisma.Decimal,
  ) {
    const discountPrice = effectiveDiscountPrice ?? offer.discountPrice;
    const regularPrice = offer.referencePrice ?? offer.originalPrice;
    const availableQuantity =
      offer.quantity - offer.reservedQuantity - offer.soldQuantity;
    return {
      id: offer.id,
      branchId: offer.branchId,
      productId: offer.productId,
      originalPrice: offer.originalPrice.toFixed(2),
      regularPrice: regularPrice.toFixed(2),
      discountPrice: discountPrice.toFixed(2),
      salePrice: discountPrice.toFixed(2),
      referencePrice: offer.referencePrice?.toFixed(2) ?? null,
      offerType: offer.offerType,
      offerTypeLabel: this.offerTypeLabel(offer.offerType),
      discountPercent: regularPrice.isZero()
        ? 0
        : Number(
            regularPrice
              .sub(discountPrice)
              .div(regularPrice)
              .mul(100)
              .toFixed(2),
          ),
      currency,
      quantity: offer.quantity,
      reservedQuantity: offer.reservedQuantity,
      soldQuantity: offer.soldQuantity,
      availableQuantity: availableQuantity,
      badges: this.deriveBadges(
        offer,
        availableQuantity,
        regularPrice,
        discountPrice,
      ),
      pickupStart: offer.pickupStart,
      pickupEnd: offer.pickupEnd,
      status: offer.status,
      publishedAt: offer.publishedAt,
      expiresAt: offer.expiresAt,
      bestBeforeAt: offer.bestBeforeAt,
      preparedAt: offer.preparedAt,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
    };
  }

  private deriveBadges(
    offer: Offer,
    availableQuantity: number,
    regularPrice: Prisma.Decimal,
    discountPrice: Prisma.Decimal,
  ): string[] {
    const badges: string[] = [];
    const now = Date.now();
    if (availableQuantity <= this.lowStockThreshold) badges.push('LOW_STOCK');
    if (offer.pickupEnd.getTime() <= now + 24 * 60 * 60 * 1_000) {
      badges.push('ENDING_SOON');
    }
    if (
      offer.publishedAt &&
      offer.publishedAt.getTime() >= now - 24 * 60 * 60 * 1_000
    ) {
      badges.push('NEW');
    }
    if (offer.soldQuantity >= 10) badges.push('POPULAR');
    if (
      !regularPrice.isZero() &&
      regularPrice.sub(discountPrice).div(regularPrice).gte(0.5)
    ) {
      badges.push('BEST_VALUE');
    }
    return badges;
  }

  private offerTypeLabel(offerType: string): string {
    return (
      (
        {
          SURPLUS: 'Surplus',
          EXPIRING_SOON: 'Expiring soon',
          OVERSTOCK: 'Overstock',
          DAILY_SPECIAL: 'Daily special',
          LAST_MINUTE: 'Last minute',
          CLEARANCE: 'Clearance',
        } as Record<string, string>
      )[offerType] ?? offerType
    );
  }

  private notFound() {
    return new AppException(
      HttpStatus.NOT_FOUND,
      'OFFER_NOT_FOUND',
      'Offer not found',
    );
  }

  private invalidTransition() {
    return new AppException(
      HttpStatus.CONFLICT,
      'OFFER_INVALID_STATUS_TRANSITION',
      'Offer status transition is not allowed',
    );
  }
}
