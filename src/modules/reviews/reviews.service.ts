import { HttpStatus, Injectable } from '@nestjs/common';
import { PriceAnomalyStatus, Prisma, ReportStatus } from '@prisma/client';
import { RequestContextData } from '../../common/decorators/request-context.decorator';
import { paginate } from '../../common/dto/pagination.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditAction, AuditEntityType } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateReportDto } from './dto/create-report.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { ListReviewsDto } from './dto/list-reviews.dto';
import { ListAnomaliesDto } from './dto/list-anomalies.dto';
import { ListReportsDto } from './dto/list-reports.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(businessId: string, query: ListReviewsDto) {
    const where: Prisma.BusinessReviewWhereInput = {
      businessId,
      status: 'PUBLISHED',
    };
    const [reviews, total, aggregate] = await this.prisma.$transaction([
      this.prisma.businessReview.findMany({
        where,
        include: { user: { select: { id: true, fullName: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.businessReview.count({ where }),
      this.prisma.businessReview.aggregate({ where, _avg: { rating: true } }),
    ]);
    return {
      ...paginate(
        reviews.map((review) => ({
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
          author: review.user,
        })),
        total,
        query,
      ),
      averageRating: aggregate._avg.rating ?? 0,
    };
  }

  async createReview(
    actor: AuthenticatedUser,
    businessId: string,
    dto: CreateReviewDto,
    context: RequestContextData = {},
  ) {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, status: 'VERIFIED', deletedAt: null },
      select: { id: true },
    });
    if (!business) throw this.businessNotFound();
    const completedOrder = await this.prisma.order.findFirst({
      where: {
        userId: actor.sub,
        status: 'COMPLETED',
        branch: { businessId },
      },
      select: { id: true },
    });
    if (!completedOrder) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'REVIEW_PURCHASE_REQUIRED',
        'A completed order is required before reviewing a business',
      );
    }
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const review = await transaction.businessReview.create({
          data: {
            userId: actor.sub,
            businessId,
            rating: dto.rating,
            comment: dto.comment,
          },
        });
        await this.audit.record(transaction, {
          actorUserId: actor.sub,
          actorRole: actor.role,
          action: AuditAction.REVIEW_CREATED,
          entityType: AuditEntityType.REVIEW,
          entityId: review.id,
          requestId: context.requestId,
          ip: context.ip,
          metadata: { businessId, rating: dto.rating },
        });
        return review;
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'REVIEW_ALREADY_EXISTS',
          'You have already reviewed this business',
        );
      }
      throw error;
    }
  }

  async createReport(
    actor: AuthenticatedUser,
    dto: CreateReportDto,
    context: RequestContextData = {},
  ) {
    if (!dto.businessId && !dto.offerId) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'REPORT_TARGET_REQUIRED',
        'A business or offer target is required',
      );
    }
    if (dto.businessId) {
      const business = await this.prisma.business.findFirst({
        where: { id: dto.businessId, deletedAt: null },
        select: { id: true },
      });
      if (!business) throw this.businessNotFound();
    }
    if (dto.offerId) {
      const offer = await this.prisma.offer.findUnique({
        where: { id: dto.offerId },
        select: { id: true, branch: { select: { businessId: true } } },
      });
      if (!offer) {
        throw new AppException(
          HttpStatus.NOT_FOUND,
          'OFFER_NOT_FOUND',
          'Offer not found',
        );
      }
      if (dto.businessId && offer.branch.businessId !== dto.businessId) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          'REPORT_TARGET_MISMATCH',
          'The offer does not belong to the selected business',
        );
      }
    }
    const report = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.businessReport.create({
        data: {
          reporterId: actor.sub,
          businessId: dto.businessId,
          offerId: dto.offerId,
          reason: dto.reason,
          details: dto.details,
        },
      });
      await this.audit.record(transaction, {
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: AuditAction.REPORT_CREATED,
        entityType: AuditEntityType.REPORT,
        entityId: created.id,
        requestId: context.requestId,
        ip: context.ip,
        metadata: {
          businessId: dto.businessId,
          offerId: dto.offerId,
          reason: dto.reason,
        },
      });
      return created;
    });
    return {
      id: report.id,
      status: report.status,
      createdAt: report.createdAt,
    };
  }

  async listReports(query: ListReportsDto) {
    const where: Prisma.BusinessReportWhereInput = { status: query.status };
    const [reports, total] = await this.prisma.$transaction([
      this.prisma.businessReport.findMany({
        where,
        include: {
          reporter: { select: { id: true, fullName: true, email: true } },
          business: { select: { id: true, name: true, slug: true } },
          offer: { select: { id: true, product: { select: { name: true } } } },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.businessReport.count({ where }),
    ]);
    return paginate(reports, total, query);
  }

  async resolveReport(
    actor: AuthenticatedUser,
    reportId: string,
    status: ReportStatus,
    context: RequestContextData = {},
  ) {
    if (status !== ReportStatus.RESOLVED && status !== ReportStatus.DISMISSED) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'REPORT_STATUS_INVALID',
        'A report can only be resolved or dismissed by moderation',
      );
    }
    const report = await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.businessReport.updateMany({
        where: {
          id: reportId,
          status: { notIn: [ReportStatus.RESOLVED, ReportStatus.DISMISSED] },
        },
        data: { status, resolvedAt: new Date() },
      });
      if (changed.count !== 1) {
        throw new AppException(
          HttpStatus.NOT_FOUND,
          'REPORT_NOT_FOUND',
          'Open report not found',
        );
      }
      await this.audit.record(transaction, {
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: AuditAction.REPORT_RESOLVED,
        entityType: AuditEntityType.REPORT,
        entityId: reportId,
        requestId: context.requestId,
        ip: context.ip,
        metadata: { status },
      });
      return transaction.businessReport.findUniqueOrThrow({
        where: { id: reportId },
      });
    });
    return report;
  }

  async listAnomalies(query: ListAnomaliesDto) {
    const where: Prisma.PriceAnomalyWhereInput = { status: query.status };
    const [anomalies, total] = await this.prisma.$transaction([
      this.prisma.priceAnomaly.findMany({
        where,
        include: {
          product: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true, city: true } },
          offer: { select: { id: true, discountPrice: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.priceAnomaly.count({ where }),
    ]);
    return paginate(
      anomalies.map((anomaly) => ({
        ...anomaly,
        previousPrice: anomaly.previousPrice.toFixed(2),
        currentPrice: anomaly.currentPrice.toFixed(2),
        increasePercent: anomaly.increasePercent.toFixed(2),
        offer: {
          ...anomaly.offer,
          discountPrice: anomaly.offer.discountPrice.toFixed(2),
        },
      })),
      total,
      query,
    );
  }

  async resolveAnomaly(
    actor: AuthenticatedUser,
    anomalyId: string,
    context: RequestContextData = {},
  ) {
    const anomaly = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.priceAnomaly.updateMany({
        where: {
          id: anomalyId,
          status: { not: PriceAnomalyStatus.RESOLVED },
        },
        data: { status: PriceAnomalyStatus.RESOLVED, resolvedAt: new Date() },
      });
      if (updated.count !== 1) {
        throw new AppException(
          HttpStatus.NOT_FOUND,
          'PRICE_ANOMALY_NOT_FOUND',
          'Unresolved price anomaly not found',
        );
      }
      await this.audit.record(transaction, {
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: AuditAction.PRICE_ANOMALY_RESOLVED,
        entityType: AuditEntityType.PRICE_ANOMALY,
        entityId: anomalyId,
        requestId: context.requestId,
        ip: context.ip,
      });
      return transaction.priceAnomaly.findUniqueOrThrow({
        where: { id: anomalyId },
      });
    });
    return anomaly;
  }

  private businessNotFound() {
    return new AppException(
      HttpStatus.NOT_FOUND,
      'BUSINESS_NOT_FOUND',
      'Business not found',
    );
  }
}
