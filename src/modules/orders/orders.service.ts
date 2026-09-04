import {
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OfferStatus, OrderStatus, Prisma } from '@prisma/client';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { RequestContextData } from '../../common/decorators/request-context.decorator';
import { paginate } from '../../common/dto/pagination.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditAction, AuditEntityType } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { BusinessAccessService } from '../business-members/business-access.service';
import { BusinessPermission } from '../business-members/business-permission.enum';
import { CompleteOrderDto } from './dto/complete-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';

type OrderWithDetails = Prisma.OrderGetPayload<{
  include: {
    items: true;
    branch: { select: { id: true; name: true; city: true } };
  };
}>;

@Injectable()
export class OrdersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersService.name);
  private readonly reservationTtlMs: number;
  private readonly expiryIntervalMs: number;
  private readonly lowStockThreshold: number;
  private readonly pickupSecret: string;
  private readonly pickupMaxAttempts: number;
  private expiryTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BusinessAccessService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.reservationTtlMs =
      config.get<number>('RESERVATION_TTL_MINUTES', 15) * 60_000;
    this.expiryIntervalMs =
      config.get<number>('ORDER_EXPIRY_INTERVAL_SECONDS', 60) * 1_000;
    this.lowStockThreshold = config.get<number>('LOW_STOCK_THRESHOLD', 3);
    this.pickupSecret = config.getOrThrow<string>('PICKUP_CODE_SECRET');
    this.pickupMaxAttempts = config.get<number>('PICKUP_MAX_ATTEMPTS', 5);
  }

  onModuleInit(): void {
    this.expiryTimer = setInterval(() => {
      void this.expireReservations().catch((error: unknown) => {
        this.logger.error(
          `Reservation expiry failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      });
    }, this.expiryIntervalMs);
    this.expiryTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.expiryTimer) clearInterval(this.expiryTimer);
  }

  async create(
    actor: AuthenticatedUser,
    dto: CreateOrderDto,
    context: RequestContextData = {},
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.createInTransaction(actor, dto, context);
      } catch (error: unknown) {
        const retryable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2034' ||
            (error.code === 'P2010' && error.meta?.code === '40001'));
        if (!retryable || attempt === 2) throw error;
      }
    }
    throw this.inventoryUnavailable();
  }

  async listMine(userId: string, query: ListOrdersDto) {
    await this.expireReservations();
    const where: Prisma.OrderWhereInput = {
      userId,
      status: query.status,
      branchId: query.branchId,
    };
    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          items: true,
          branch: { select: { id: true, name: true, city: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(
      orders.map((order) => this.toResponse(order, true)),
      total,
      query,
    );
  }

  async getMine(userId: string, orderId: string) {
    await this.expireOrderIfNeeded(orderId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: true,
        branch: { select: { id: true, name: true, city: true } },
      },
    });
    if (!order) throw this.notFound();
    return this.toResponse(order, true);
  }

  async cancelMine(
    actor: AuthenticatedUser,
    orderId: string,
    context: RequestContextData = {},
  ) {
    await this.expireOrderIfNeeded(orderId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId: actor.sub },
      include: { items: true },
    });
    if (!order) throw this.notFound();
    if (order.status !== OrderStatus.RESERVED) throw this.invalidTransition();
    const now = new Date();
    await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.order.updateMany({
        where: { id: orderId, status: OrderStatus.RESERVED },
        data: { status: OrderStatus.CANCELLED, cancelledAt: now },
      });
      if (changed.count !== 1) throw this.invalidTransition();
      for (const item of order.items) {
        await this.restoreReservedInventory(
          transaction,
          item.offerId,
          item.quantity,
        );
      }
      await this.audit.record(transaction, {
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: AuditAction.ORDER_CANCELLED,
        entityType: AuditEntityType.ORDER,
        entityId: orderId,
        requestId: context.requestId,
        ip: context.ip,
      });
    });
    return { success: true };
  }

  async listBusiness(userId: string, businessId: string, query: ListOrdersDto) {
    await this.access.requireManager(
      userId,
      businessId,
      BusinessPermission.ORDER_READ,
    );
    await this.expireReservations();
    const where: Prisma.OrderWhereInput = {
      status: query.status,
      branchId: query.branchId,
      branch: { businessId },
    };
    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          items: true,
          branch: { select: { id: true, name: true, city: true } },
          user: { select: { id: true, fullName: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(
      orders.map((order) => ({
        ...this.toResponse(order, false),
        customer: order.user,
      })),
      total,
      query,
    );
  }

  async markReady(
    actor: AuthenticatedUser,
    businessId: string,
    orderId: string,
    context: RequestContextData = {},
  ) {
    await this.access.requireManager(
      actor.sub,
      businessId,
      BusinessPermission.ORDER_COMPLETE,
    );
    await this.expireOrderIfNeeded(orderId);
    const order = await this.requireBusinessOrder(businessId, orderId);
    if (order.status !== OrderStatus.RESERVED) throw this.invalidTransition();
    const updated = await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.order.updateMany({
        where: { id: orderId, status: OrderStatus.RESERVED },
        data: { status: OrderStatus.READY },
      });
      if (changed.count !== 1) throw this.invalidTransition();
      await this.audit.record(transaction, {
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: AuditAction.ORDER_READY,
        entityType: AuditEntityType.ORDER,
        entityId: orderId,
        requestId: context.requestId,
        ip: context.ip,
      });
      await transaction.notification.create({
        data: {
          userId: order.userId,
          type: 'ORDER_READY',
          title: 'Order ready for pickup',
          message: 'Your Qolmasin order is ready for pickup',
          data: { orderId },
        },
      });
      return transaction.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          items: true,
          branch: { select: { id: true, name: true, city: true } },
        },
      });
    });
    return this.toResponse(updated, false);
  }

  async complete(
    actor: AuthenticatedUser,
    businessId: string,
    orderId: string,
    dto: CompleteOrderDto,
    context: RequestContextData = {},
  ) {
    await this.access.requireManager(
      actor.sub,
      businessId,
      BusinessPermission.ORDER_COMPLETE,
    );
    await this.expireOrderIfNeeded(orderId);
    const order = await this.requireBusinessOrder(businessId, orderId);
    if (!this.isFulfillableOrderStatus(order.status)) {
      throw this.invalidTransition();
    }
    const offerWindows = await this.prisma.offer.findMany({
      where: { id: { in: order.items.map((item) => item.offerId) } },
      select: { id: true, pickupStart: true, pickupEnd: true },
    });
    const now = new Date();
    if (
      offerWindows.some(
        (offer) => now < offer.pickupStart || now > offer.pickupEnd,
      )
    ) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'ORDER_OUTSIDE_PICKUP_WINDOW',
        'The order can only be completed during the pickup window',
      );
    }
    if (order.pickupAttempts >= this.pickupMaxAttempts) {
      throw new AppException(
        HttpStatus.TOO_MANY_REQUESTS,
        'PICKUP_CODE_LOCKED',
        'Pickup verification is locked for this order',
      );
    }
    const suppliedHash = this.hashPickupCode(dto.pickupCode);
    if (!this.safeEqual(suppliedHash, order.pickupCodeHash)) {
      await this.prisma.order.updateMany({
        where: {
          id: orderId,
          status: { in: [OrderStatus.RESERVED, OrderStatus.READY] },
          pickupAttempts: { lt: this.pickupMaxAttempts },
        },
        data: { pickupAttempts: { increment: 1 } },
      });
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'PICKUP_CODE_INVALID',
        'Pickup code is invalid',
      );
    }

    const updated = await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.order.updateMany({
        where: {
          id: orderId,
          status: { in: [OrderStatus.RESERVED, OrderStatus.READY] },
        },
        data: { status: OrderStatus.COMPLETED, completedAt: now },
      });
      if (changed.count !== 1) throw this.invalidTransition();
      for (const item of order.items) {
        await this.sellReservedInventory(
          transaction,
          item.offerId,
          item.quantity,
        );
      }
      await this.audit.record(transaction, {
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: AuditAction.ORDER_COMPLETED,
        entityType: AuditEntityType.ORDER,
        entityId: orderId,
        requestId: context.requestId,
        ip: context.ip,
      });
      await transaction.notification.create({
        data: {
          userId: order.userId,
          type: 'ORDER_COMPLETED',
          title: 'Order completed',
          message: 'Thank you for rescuing food with Qolmasin',
          data: { orderId },
        },
      });
      return transaction.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          items: true,
          branch: { select: { id: true, name: true, city: true } },
        },
      });
    });
    return this.toResponse(updated, false);
  }

  async expireReservations(): Promise<number> {
    const expired = await this.prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.RESERVED, OrderStatus.READY] },
        reservedUntil: { lte: new Date() },
      },
      select: { id: true },
      orderBy: { reservedUntil: 'asc' },
      take: 100,
    });
    let count = 0;
    for (const order of expired) {
      if (await this.expireOrderIfNeeded(order.id)) count += 1;
    }
    return count;
  }

  private async createInTransaction(
    actor: AuthenticatedUser,
    dto: CreateOrderDto,
    context: RequestContextData,
  ) {
    const sortedItems = [...dto.items].sort((a, b) =>
      a.offerId.localeCompare(b.offerId),
    );
    const offerIds = sortedItems.map((item) => item.offerId);
    const orderId = randomUUID();
    const pickupCode = this.createPickupCode(orderId);
    const pickupCodeHash = this.hashPickupCode(pickupCode);
    const result = await this.prisma.$transaction(
      async (transaction) => {
        const now = new Date();
        const offers = await transaction.offer.findMany({
          where: { id: { in: offerIds } },
          include: {
            branch: { include: { business: true } },
            product: { include: { category: true } },
            discountSchedules: {
              where: { startsAt: { lte: now } },
              orderBy: { startsAt: 'desc' },
              take: 1,
            },
          },
        });
        if (offers.length !== offerIds.length)
          throw this.inventoryUnavailable();
        const offerMap = new Map(offers.map((offer) => [offer.id, offer]));
        const firstBranchId = offers[0]?.branchId;
        let subtotal = new Prisma.Decimal(0);
        let total = new Prisma.Decimal(0);
        let reservationDeadline = new Date(
          now.getTime() + this.reservationTtlMs,
        );
        const itemData: Prisma.OrderItemCreateWithoutOrderInput[] = [];

        for (const requested of sortedItems) {
          const offer = offerMap.get(requested.offerId);
          if (
            !offer ||
            offer.branchId !== firstBranchId ||
            !this.isReservableOfferStatus(offer.status) ||
            offer.expiresAt <= now ||
            offer.branch.status !== 'ACTIVE' ||
            offer.branch.deletedAt ||
            offer.branch.business.status !== 'VERIFIED' ||
            offer.branch.business.deletedAt ||
            offer.product.status !== 'ACTIVE' ||
            offer.product.deletedAt ||
            offer.product.category.status !== 'ACTIVE'
          ) {
            throw this.inventoryUnavailable();
          }
          await this.reserveInventory(
            transaction,
            offer.id,
            requested.quantity,
          );
          const salePrice =
            offer.discountSchedules[0]?.price ?? offer.discountPrice;
          const originalLine = offer.originalPrice.mul(requested.quantity);
          const saleLine = salePrice.mul(requested.quantity);
          subtotal = subtotal.add(originalLine);
          total = total.add(saleLine);
          if (offer.expiresAt < reservationDeadline) {
            reservationDeadline = offer.expiresAt;
          }
          if (offer.pickupEnd < reservationDeadline) {
            reservationDeadline = offer.pickupEnd;
          }
          itemData.push({
            offer: { connect: { id: offer.id } },
            productNameSnapshot: offer.product.name,
            unitOriginalPrice: offer.originalPrice,
            unitSalePrice: salePrice,
            quantity: requested.quantity,
            lineTotal: saleLine,
          });
        }
        if (!firstBranchId || reservationDeadline <= now) {
          throw this.inventoryUnavailable();
        }
        const order = await transaction.order.create({
          data: {
            id: orderId,
            userId: actor.sub,
            branchId: firstBranchId,
            status: OrderStatus.RESERVED,
            subtotal,
            discount: subtotal.sub(total),
            total,
            currency: offers[0].branch.currency,
            pickupCodeHash,
            reservedUntil: reservationDeadline,
            items: { create: itemData },
          },
          include: {
            items: true,
            branch: { select: { id: true, name: true, city: true } },
          },
        });
        await this.audit.record(transaction, {
          actorUserId: actor.sub,
          actorRole: actor.role,
          action: AuditAction.ORDER_RESERVED,
          entityType: AuditEntityType.ORDER,
          entityId: order.id,
          requestId: context.requestId,
          ip: context.ip,
          metadata: { itemCount: itemData.length, total: total.toFixed(2) },
        });
        await transaction.notification.create({
          data: {
            userId: actor.sub,
            type: 'ORDER_RESERVED',
            title: 'Offer reserved',
            message: 'Your offer is reserved. Pick it up before the deadline.',
            data: {
              orderId: order.id,
              reservedUntil: reservationDeadline.toISOString(),
            },
          },
        });
        return order;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { ...this.toResponse(result, true), pickupCode };
  }

  private async requireBusinessOrder(businessId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branch: { businessId } },
      include: {
        items: true,
        branch: { select: { id: true, name: true, city: true } },
      },
    });
    if (!order) throw this.notFound();
    return order;
  }

  private async expireOrderIfNeeded(orderId: string): Promise<boolean> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        status: { in: [OrderStatus.RESERVED, OrderStatus.READY] },
        reservedUntil: { lte: new Date() },
      },
      include: {
        items: true,
        user: { select: { role: true } },
      },
    });
    if (!order) return false;
    const now = new Date();
    return this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.order.updateMany({
        where: {
          id: orderId,
          status: { in: [OrderStatus.RESERVED, OrderStatus.READY] },
          reservedUntil: { lte: now },
        },
        data: { status: OrderStatus.EXPIRED, cancelledAt: now },
      });
      if (changed.count !== 1) return false;
      for (const item of order.items) {
        await this.restoreReservedInventory(
          transaction,
          item.offerId,
          item.quantity,
        );
      }
      await this.audit.record(transaction, {
        actorUserId: order.userId,
        actorRole: order.user.role,
        action: AuditAction.ORDER_EXPIRED,
        entityType: AuditEntityType.ORDER,
        entityId: orderId,
        metadata: { trigger: 'SYSTEM' },
      });
      return true;
    });
  }

  private async reserveInventory(
    transaction: Prisma.TransactionClient,
    offerId: string,
    quantity: number,
  ): Promise<void> {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "offers"
      SET "reserved_quantity" = "reserved_quantity" + ${quantity},
          status = (CASE
            WHEN quantity - ("reserved_quantity" + ${quantity}) - "sold_quantity" = 0 THEN 'SOLD_OUT'
            WHEN quantity - ("reserved_quantity" + ${quantity}) - "sold_quantity" <= ${this.lowStockThreshold} THEN 'LOW_STOCK'
            ELSE 'ACTIVE'
          END)::"OfferStatus",
          "updated_at" = NOW()
      WHERE id = ${offerId}::uuid
        AND status IN ('ACTIVE'::"OfferStatus", 'LOW_STOCK'::"OfferStatus")
        AND "expires_at" > NOW()
        AND "pickup_end" > NOW()
        AND quantity - "reserved_quantity" - "sold_quantity" >= ${quantity}
      RETURNING id
    `);
    if (rows.length !== 1) throw this.inventoryUnavailable();
  }

  private async restoreReservedInventory(
    transaction: Prisma.TransactionClient,
    offerId: string,
    quantity: number,
  ): Promise<void> {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "offers"
      SET "reserved_quantity" = "reserved_quantity" - ${quantity},
          status = (CASE
            WHEN status IN ('CANCELLED'::"OfferStatus", 'EXPIRED'::"OfferStatus") THEN status
            WHEN quantity - ("reserved_quantity" - ${quantity}) - "sold_quantity" = 0 THEN 'SOLD_OUT'::"OfferStatus"
            WHEN quantity - ("reserved_quantity" - ${quantity}) - "sold_quantity" <= ${this.lowStockThreshold} THEN 'LOW_STOCK'::"OfferStatus"
            ELSE 'ACTIVE'::"OfferStatus"
          END),
          "updated_at" = NOW()
      WHERE id = ${offerId}::uuid AND "reserved_quantity" >= ${quantity}
      RETURNING id
    `);
    if (rows.length !== 1) throw this.inventoryInvariantFailure();
  }

  private async sellReservedInventory(
    transaction: Prisma.TransactionClient,
    offerId: string,
    quantity: number,
  ): Promise<void> {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "offers"
      SET "reserved_quantity" = "reserved_quantity" - ${quantity},
          "sold_quantity" = "sold_quantity" + ${quantity},
          status = (CASE
            WHEN status IN ('CANCELLED'::"OfferStatus", 'EXPIRED'::"OfferStatus") THEN status
            WHEN quantity - "reserved_quantity" - "sold_quantity" = 0 THEN 'SOLD_OUT'::"OfferStatus"
            WHEN quantity - "reserved_quantity" - "sold_quantity" <= ${this.lowStockThreshold} THEN 'LOW_STOCK'::"OfferStatus"
            ELSE 'ACTIVE'::"OfferStatus"
          END),
          "updated_at" = NOW()
      WHERE id = ${offerId}::uuid AND "reserved_quantity" >= ${quantity}
      RETURNING id
    `);
    if (rows.length !== 1) throw this.inventoryInvariantFailure();
  }

  private createPickupCode(orderId: string): string {
    const digest = createHmac('sha256', this.pickupSecret)
      .update(`pickup:${orderId}`)
      .digest();
    const number = digest.readUInt32BE(0) % 1_000_000;
    return `QOL-${number.toString().padStart(6, '0')}`;
  }

  private hashPickupCode(code: string): string {
    return createHmac('sha256', this.pickupSecret).update(code).digest('hex');
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private toResponse(order: OrderWithDetails, includePickupCode: boolean) {
    const activePickup =
      includePickupCode && this.isFulfillableOrderStatus(order.status);
    return {
      id: order.id,
      branchId: order.branchId,
      branch: order.branch,
      status: order.status,
      subtotal: order.subtotal.toFixed(2),
      discount: order.discount.toFixed(2),
      total: order.total.toFixed(2),
      currency: order.currency,
      pickupCode: activePickup ? this.createPickupCode(order.id) : undefined,
      reservedUntil: order.reservedUntil,
      createdAt: order.createdAt,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,
      items: order.items.map((item) => ({
        id: item.id,
        offerId: item.offerId,
        productName: item.productNameSnapshot,
        unitOriginalPrice: item.unitOriginalPrice.toFixed(2),
        unitSalePrice: item.unitSalePrice.toFixed(2),
        quantity: item.quantity,
        lineTotal: item.lineTotal.toFixed(2),
      })),
    };
  }

  private inventoryUnavailable() {
    return new AppException(
      HttpStatus.CONFLICT,
      'INVENTORY_UNAVAILABLE',
      'One or more offers are unavailable in the requested quantity',
    );
  }

  private isFulfillableOrderStatus(status: OrderStatus): boolean {
    return status === OrderStatus.RESERVED || status === OrderStatus.READY;
  }

  private isReservableOfferStatus(status: OfferStatus): boolean {
    return status === OfferStatus.ACTIVE || status === OfferStatus.LOW_STOCK;
  }

  private inventoryInvariantFailure() {
    return new AppException(
      HttpStatus.CONFLICT,
      'INVENTORY_INVARIANT_FAILED',
      'Inventory state changed unexpectedly',
    );
  }

  private notFound() {
    return new AppException(
      HttpStatus.NOT_FOUND,
      'ORDER_NOT_FOUND',
      'Order not found',
    );
  }

  private invalidTransition() {
    return new AppException(
      HttpStatus.CONFLICT,
      'ORDER_INVALID_STATUS_TRANSITION',
      'Order status transition is not allowed',
    );
  }
}
