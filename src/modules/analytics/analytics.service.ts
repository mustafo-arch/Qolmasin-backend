import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { BusinessAccessService } from '../business-members/business-access.service';
import { BusinessPermission } from '../business-members/business-permission.enum';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BusinessAccessService,
  ) {}

  async businessOverview(userId: string, businessId: string) {
    await this.access.requireManager(
      userId,
      businessId,
      BusinessPermission.ANALYTICS_VIEW,
    );
    const completedWhere: Prisma.OrderWhereInput = {
      status: 'COMPLETED',
      branch: { businessId },
    };
    const [
      orders,
      offers,
      topOffers,
      totalOrders,
      activeOffers,
      expiredOffers,
      reviews,
      anomalyCount,
    ] = await this.prisma.$transaction([
      this.prisma.order.aggregate({
        where: completedWhere,
        _count: { _all: true },
        _sum: { total: true, discount: true, subtotal: true },
      }),
      this.prisma.offer.aggregate({
        where: { branch: { businessId } },
        _count: { _all: true },
        _sum: { quantity: true, soldQuantity: true, reservedQuantity: true },
      }),
      this.prisma.orderItem.findMany({
        where: { order: completedWhere },
        select: {
          productNameSnapshot: true,
          quantity: true,
          lineTotal: true,
        },
        orderBy: { quantity: 'desc' },
        take: 10,
      }),
      this.prisma.order.count({
        where: { branch: { businessId } },
      }),
      this.prisma.offer.count({
        where: {
          branch: { businessId },
          status: { in: ['ACTIVE', 'LOW_STOCK'] },
          expiresAt: { gt: new Date() },
          pickupEnd: { gt: new Date() },
        },
      }),
      this.prisma.offer.count({
        where: { branch: { businessId }, status: 'EXPIRED' },
      }),
      this.prisma.businessReview.aggregate({
        where: { businessId, status: 'PUBLISHED' },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.priceAnomaly.count({
        where: { branch: { businessId }, status: { not: 'RESOLVED' } },
      }),
    ]);
    const ratingScore = ((reviews._avg.rating ?? 0) / 5) * 60;
    const reliabilityScore = totalOrders
      ? (orders._count._all / totalOrders) * 30
      : 0;
    const qualityScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(ratingScore + reliabilityScore - anomalyCount * 5 + 10),
      ),
    );
    const averageDiscount = orders._sum.subtotal?.isZero()
      ? new Prisma.Decimal(0)
      : orders._sum.subtotal
        ? (orders._sum.discount?.div(orders._sum.subtotal).mul(100) ??
          new Prisma.Decimal(0))
        : new Prisma.Decimal(0);
    const conversionRate = totalOrders
      ? Number(((orders._count._all / totalOrders) * 100).toFixed(2))
      : 0;
    return {
      businessId,
      completedOrders: orders._count._all,
      revenue: orders._sum.total?.toFixed(2) ?? '0.00',
      recoveredRevenue: orders._sum.total?.toFixed(2) ?? '0.00',
      customerSavings: orders._sum.discount?.toFixed(2) ?? '0.00',
      activeOffers,
      soldItems: offers._sum.soldQuantity ?? 0,
      expiredOffers,
      averageDiscount: Number(averageDiscount.toFixed(2)),
      conversionRate,
      qualityScore,
      qualitySignals: {
        averageRating: reviews._avg.rating ?? 0,
        reviewCount: reviews._count._all,
        completionRate: totalOrders
          ? Number(((orders._count._all / totalOrders) * 100).toFixed(2))
          : 0,
        unresolvedPriceAnomalies: anomalyCount,
      },
      offers: {
        total: offers._count._all,
        publishedQuantity: offers._sum.quantity ?? 0,
        soldQuantity: offers._sum.soldQuantity ?? 0,
        reservedQuantity: offers._sum.reservedQuantity ?? 0,
      },
      topPurchasedItems: topOffers.map((item) => ({
        productName: item.productNameSnapshot,
        quantity: item.quantity,
        revenue: item.lineTotal.toFixed(2),
      })),
    };
  }

  async customerImpact(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId, status: 'COMPLETED' },
      select: { discount: true, items: { select: { quantity: true } } },
    });
    const savings = orders.reduce(
      (sum, order) => sum.add(order.discount),
      new Prisma.Decimal(0),
    );
    const rescuedItems = orders.reduce(
      (sum, order) =>
        sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    );
    return {
      completedOrders: orders.length,
      moneySaved: savings.toFixed(2),
      totalSavedMoney: savings.toFixed(2),
      rescuedItems,
      ordersCompleted: orders.length,
      productsPurchased: rescuedItems,
      impactMessage: `${rescuedItems} food items were rescued from waste`,
    };
  }
}
