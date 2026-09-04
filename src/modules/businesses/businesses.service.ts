import { HttpStatus, Injectable } from '@nestjs/common';
import { Business, BusinessStatus, Prisma } from '@prisma/client';
import { RequestContextData } from '../../common/decorators/request-context.decorator';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { createUniqueSlug } from '../../common/utils/slug.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditAction, AuditEntityType } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { BusinessAccessService } from '../business-members/business-access.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { ListModerationBusinessesDto } from './dto/list-moderation-businesses.dto';
import { ReviewBusinessDto } from './dto/review-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

@Injectable()
export class BusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BusinessAccessService,
    private readonly audit: AuditService,
  ) {}

  async create(
    user: AuthenticatedUser,
    dto: CreateBusinessDto,
    context: RequestContextData = {},
  ) {
    if (!user.emailVerifiedAt) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'AUTH_EMAIL_NOT_VERIFIED',
        'Email verification is required',
      );
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const business = await this.prisma.$transaction(async (transaction) => {
          const created = await transaction.business.create({
            data: {
              ownerId: user.sub,
              name: dto.name,
              slug: createUniqueSlug(dto.name),
              description: dto.description,
              type: dto.type,
            },
          });
          await transaction.businessMember.create({
            data: {
              businessId: created.id,
              userId: user.sub,
              role: 'OWNER',
              status: 'ACTIVE',
            },
          });
          await this.audit.record(transaction, {
            actorUserId: user.sub,
            actorRole: user.role,
            action: AuditAction.BUSINESS_CREATED,
            entityType: AuditEntityType.BUSINESS,
            entityId: created.id,
            requestId: context.requestId,
            ip: context.ip,
            metadata: { type: created.type },
          });
          return created;
        });
        return this.toManagedResponse(business);
      } catch (error: unknown) {
        const slugCollision =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002';
        if (!slugCollision || attempt === 1) throw error;
      }
    }
    throw new AppException(
      HttpStatus.CONFLICT,
      'BUSINESS_SLUG_CONFLICT',
      'Unable to create a unique business slug',
    );
  }

  async listMine(userId: string, pagination: PaginationDto) {
    const where: Prisma.BusinessWhereInput = {
      deletedAt: null,
      members: { some: { userId, status: 'ACTIVE' } },
    };
    const [businesses, total] = await this.prisma.$transaction([
      this.prisma.business.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.business.count({ where }),
    ]);
    return paginate(
      businesses.map((item) => this.toManagedResponse(item)),
      total,
      pagination,
    );
  }

  async getPublicBySlug(slug: string) {
    const business = await this.prisma.business.findFirst({
      where: { slug, status: 'VERIFIED', deletedAt: null },
      include: {
        branches: {
          where: { status: 'ACTIVE', deletedAt: null },
          select: {
            id: true,
            name: true,
            address: true,
            countryCode: true,
            region: true,
            city: true,
            district: true,
            latitude: true,
            longitude: true,
            phone: true,
            timezone: true,
            currency: true,
            openingTime: true,
            closingTime: true,
            offers: {
              where: {
                status: { in: ['ACTIVE', 'LOW_STOCK'] },
                expiresAt: { gt: new Date() },
                pickupEnd: { gt: new Date() },
                product: { status: 'ACTIVE', deletedAt: null },
              },
              orderBy: { expiresAt: 'asc' },
              take: 50,
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    quantityUnit: true,
                    images: {
                      orderBy: { sortOrder: 'asc' },
                      take: 1,
                      select: { url: true },
                    },
                  },
                },
                discountSchedules: {
                  where: { startsAt: { lte: new Date() } },
                  orderBy: { startsAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    if (!business) throw this.notFound();
    const rating = await this.prisma.businessReview.aggregate({
      where: { businessId: business.id, status: 'PUBLISHED' },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return {
      ...this.toPublicResponse(business),
      rating: rating._avg.rating ?? 0,
      reviewCount: rating._count._all,
      branches: business.branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        address: branch.address,
        countryCode: branch.countryCode,
        region: branch.region,
        city: branch.city,
        district: branch.district,
        latitude: branch.latitude,
        longitude: branch.longitude,
        phone: branch.phone,
        timezone: branch.timezone,
        currency: branch.currency,
        openingTime: branch.openingTime,
        closingTime: branch.closingTime,
        offers: branch.offers.map((offer) => ({
          ...(() => {
            const discountPrice =
              offer.discountSchedules[0]?.price ?? offer.discountPrice;
            const regularPrice = offer.referencePrice ?? offer.originalPrice;
            return {
              discountPrice: discountPrice.toFixed(2),
              salePrice: discountPrice.toFixed(2),
              regularPrice: regularPrice.toFixed(2),
              discountPercent: regularPrice.isZero()
                ? 0
                : Number(
                    regularPrice
                      .sub(discountPrice)
                      .div(regularPrice)
                      .mul(100)
                      .toFixed(2),
                  ),
            };
          })(),
          id: offer.id,
          productId: offer.productId,
          product: {
            id: offer.product.id,
            name: offer.product.name,
            quantityUnit: offer.product.quantityUnit,
            imageUrl: offer.product.images[0]?.url ?? null,
          },
          originalPrice: offer.originalPrice.toFixed(2),
          referencePrice: offer.referencePrice?.toFixed(2) ?? null,
          offerType: offer.offerType,
          availableQuantity:
            offer.quantity - offer.reservedQuantity - offer.soldQuantity,
          pickupStart: offer.pickupStart,
          pickupEnd: offer.pickupEnd,
          expiresAt: offer.expiresAt,
          status: offer.status,
        })),
      })),
    };
  }

  async update(
    user: AuthenticatedUser,
    businessId: string,
    dto: UpdateBusinessDto,
    context: RequestContextData = {},
  ) {
    const member = await this.access.requireOwner(user.sub, businessId);
    if (member.business.status === 'PENDING_REVIEW') {
      throw new AppException(
        HttpStatus.CONFLICT,
        'BUSINESS_REVIEW_IN_PROGRESS',
        'Business cannot be changed while verification is in progress',
      );
    }
    const identityChanged = dto.name !== undefined || dto.type !== undefined;
    const resetVerification =
      identityChanged && member.business.status === BusinessStatus.VERIFIED;
    const changedFields = Object.entries(dto)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    const business = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.business.update({
        where: { id: businessId },
        data: {
          name: dto.name,
          description: dto.description,
          type: dto.type,
          status: resetVerification ? BusinessStatus.PENDING_REVIEW : undefined,
          statusReason: resetVerification ? null : undefined,
          verifiedAt: resetVerification ? null : undefined,
          reviewedAt: resetVerification ? null : undefined,
          reviewedById: resetVerification ? null : undefined,
        },
      });
      await this.audit.record(transaction, {
        actorUserId: user.sub,
        actorRole: user.role,
        action: AuditAction.BUSINESS_UPDATED,
        entityType: AuditEntityType.BUSINESS,
        entityId: businessId,
        requestId: context.requestId,
        ip: context.ip,
        metadata: {
          changedFields,
          verificationReset: resetVerification,
        },
      });
      return updated;
    });
    return this.toManagedResponse(business);
  }

  async submitForVerification(
    user: AuthenticatedUser,
    businessId: string,
    context: RequestContextData = {},
  ) {
    const member = await this.access.requireOwner(user.sub, businessId);
    if (!['DRAFT', 'REJECTED'].includes(member.business.status)) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'BUSINESS_INVALID_STATUS_TRANSITION',
        'Business cannot be submitted in its current status',
      );
    }
    const business = await this.prisma.$transaction(async (transaction) => {
      const branchCount = await transaction.branch.count({
        where: { businessId, deletedAt: null, status: { not: 'ARCHIVED' } },
      });
      if (branchCount === 0) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          'BUSINESS_BRANCH_REQUIRED',
          'At least one branch is required before verification',
        );
      }
      const changed = await transaction.business.updateMany({
        where: {
          id: businessId,
          status: member.business.status,
          deletedAt: null,
        },
        data: {
          status: BusinessStatus.PENDING_REVIEW,
          statusReason: null,
          verifiedAt: null,
          reviewedAt: null,
          reviewedById: null,
        },
      });
      if (changed.count !== 1) throw this.invalidTransition();
      await this.audit.record(transaction, {
        actorUserId: user.sub,
        actorRole: user.role,
        action: AuditAction.BUSINESS_VERIFICATION_SUBMITTED,
        entityType: AuditEntityType.BUSINESS,
        entityId: businessId,
        requestId: context.requestId,
        ip: context.ip,
        metadata: { fromStatus: member.business.status },
      });
      return transaction.business.findUniqueOrThrow({
        where: { id: businessId },
      });
    });
    return this.toManagedResponse(business);
  }

  async listForModeration(query: ListModerationBusinessesDto) {
    const where: Prisma.BusinessWhereInput = {
      status: query.status,
      deletedAt: null,
    };
    const [businesses, total] = await this.prisma.$transaction([
      this.prisma.business.findMany({
        where,
        include: {
          owner: { select: { id: true, fullName: true, email: true } },
          _count: { select: { branches: true, products: true } },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.business.count({ where }),
    ]);
    return paginate(
      businesses.map((business) => this.toModerationResponse(business)),
      total,
      query,
    );
  }

  async review(
    actor: AuthenticatedUser,
    businessId: string,
    dto: ReviewBusinessDto,
    context: RequestContextData = {},
  ) {
    if (
      (dto.status === BusinessStatus.REJECTED ||
        dto.status === BusinessStatus.SUSPENDED) &&
      !dto.reason
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'BUSINESS_STATUS_REASON_REQUIRED',
        'A reason is required to reject or suspend a business',
      );
    }
    const now = new Date();
    const business = await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.business.findFirst({
        where: { id: businessId, deletedAt: null },
      });
      if (!existing) throw this.notFound();
      this.assertReviewTransition(existing.status, dto.status);

      if (dto.status === BusinessStatus.VERIFIED) {
        const branchCount = await transaction.branch.count({
          where: { businessId, deletedAt: null, status: { not: 'ARCHIVED' } },
        });
        if (branchCount === 0) {
          throw new AppException(
            HttpStatus.BAD_REQUEST,
            'BUSINESS_BRANCH_REQUIRED',
            'A business without a branch cannot be verified',
          );
        }
      }

      const changed = await transaction.business.updateMany({
        where: {
          id: businessId,
          status: existing.status,
          deletedAt: null,
        },
        data: {
          status: dto.status,
          statusReason:
            dto.status === BusinessStatus.VERIFIED ? null : dto.reason,
          verifiedAt: dto.status === BusinessStatus.VERIFIED ? now : null,
          reviewedAt: now,
          reviewedById: actor.sub,
        },
      });
      if (changed.count !== 1) throw this.invalidTransition();

      const metadata: Prisma.InputJsonObject = {
        fromStatus: existing.status,
        toStatus: dto.status,
        ...(dto.reason ? { reason: dto.reason } : {}),
      };
      await this.audit.record(transaction, {
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: this.reviewAuditAction(existing.status, dto.status),
        entityType: AuditEntityType.BUSINESS,
        entityId: businessId,
        requestId: context.requestId,
        ip: context.ip,
        metadata,
      });
      return transaction.business.findUniqueOrThrow({
        where: { id: businessId },
        include: {
          owner: { select: { id: true, fullName: true, email: true } },
          _count: { select: { branches: true, products: true } },
        },
      });
    });
    return this.toModerationResponse(business);
  }

  private assertReviewTransition(
    current: BusinessStatus,
    next: ReviewBusinessDto['status'],
  ) {
    const allowed: Partial<Record<BusinessStatus, BusinessStatus[]>> = {
      [BusinessStatus.PENDING_REVIEW]: [
        BusinessStatus.VERIFIED,
        BusinessStatus.REJECTED,
      ],
      [BusinessStatus.VERIFIED]: [BusinessStatus.SUSPENDED],
      [BusinessStatus.SUSPENDED]: [BusinessStatus.VERIFIED],
    };
    if (!allowed[current]?.includes(next)) throw this.invalidTransition();
  }

  private reviewAuditAction(
    current: BusinessStatus,
    next: ReviewBusinessDto['status'],
  ): AuditAction {
    if (next === BusinessStatus.REJECTED) return AuditAction.BUSINESS_REJECTED;
    if (next === BusinessStatus.SUSPENDED)
      return AuditAction.BUSINESS_SUSPENDED;
    return current === BusinessStatus.SUSPENDED
      ? AuditAction.BUSINESS_REINSTATED
      : AuditAction.BUSINESS_VERIFIED;
  }

  private toManagedResponse(business: Business) {
    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      description: business.description,
      type: business.type,
      status: business.status,
      statusReason: business.statusReason,
      verifiedAt: business.verifiedAt,
      reviewedAt: business.reviewedAt,
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
    };
  }

  private toPublicResponse(business: Business) {
    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      description: business.description,
      type: business.type,
      status: business.status,
      verifiedAt: business.verifiedAt,
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
    };
  }

  private toModerationResponse(
    business: Business & {
      owner: { id: string; fullName: string; email: string | null };
      _count: { branches: number; products: number };
    },
  ) {
    return {
      ...this.toManagedResponse(business),
      owner: business.owner,
      counts: business._count,
    };
  }

  private notFound() {
    return new AppException(
      HttpStatus.NOT_FOUND,
      'BUSINESS_NOT_FOUND',
      'Business not found',
    );
  }

  private invalidTransition() {
    return new AppException(
      HttpStatus.CONFLICT,
      'BUSINESS_INVALID_STATUS_TRANSITION',
      'Business status changed or the requested transition is not allowed',
    );
  }
}
