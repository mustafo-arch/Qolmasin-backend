import { OrderStatus, UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BusinessAccessService } from '../business-members/business-access.service';
import { OrdersService } from './orders.service';

type ExpiryStatusFilter = { in: OrderStatus[] };

type ExpiryListArgs = {
  where: {
    status: ExpiryStatusFilter;
    reservedUntil: { lte: Date };
  };
  select: { id: true };
  orderBy: { reservedUntil: 'asc' };
  take: number;
};

type ExpiryUpdateArgs = {
  where: {
    id: string;
    status: ExpiryStatusFilter;
    reservedUntil: { lte: Date };
  };
  data: { status: OrderStatus; cancelledAt: Date };
};

describe('OrdersService', () => {
  it('expires a READY order and restores its reserved inventory', async () => {
    const orderFindMany = jest
      .fn<Promise<Array<{ id: string }>>, [ExpiryListArgs]>()
      .mockResolvedValue([{ id: 'order-id' }]);
    const orderFindFirst = jest.fn().mockResolvedValue({
      id: 'order-id',
      userId: 'user-id',
      status: OrderStatus.READY,
      reservedUntil: new Date(Date.now() - 1_000),
      user: { role: UserRole.CUSTOMER },
      items: [{ offerId: 'offer-id', quantity: 2 }],
    });
    const orderUpdateMany = jest
      .fn<Promise<{ count: number }>, [ExpiryUpdateArgs]>()
      .mockResolvedValue({ count: 1 });
    const queryRaw = jest.fn().mockResolvedValue([{ id: 'offer-id' }]);
    const transaction = {
      order: { updateMany: orderUpdateMany },
      $queryRaw: queryRaw,
    };
    const prisma = {
      order: { findMany: orderFindMany, findFirst: orderFindFirst },
      $transaction: jest.fn(
        (operation: (value: typeof transaction) => unknown) =>
          Promise.resolve(operation(transaction)),
      ),
    };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const config = {
      get: jest.fn((_key: string, fallback: unknown) => fallback),
      getOrThrow: jest.fn().mockReturnValue('pickup-secret'),
    };
    const service = new OrdersService(
      prisma as unknown as PrismaService,
      {} as BusinessAccessService,
      audit as unknown as AuditService,
      config as unknown as ConfigService,
    );

    await expect(service.expireReservations()).resolves.toBe(1);
    const findManyCall = orderFindMany.mock.calls[0];
    if (!findManyCall) throw new Error('Order list query was not called');
    const findManyArgs = findManyCall[0];
    expect(findManyArgs.where.status.in).toEqual([
      OrderStatus.RESERVED,
      OrderStatus.READY,
    ]);
    const updateManyCall = orderUpdateMany.mock.calls[0];
    if (!updateManyCall) throw new Error('Order update query was not called');
    const updateManyArgs = updateManyCall[0];
    expect(updateManyArgs.where.status.in).toEqual([
      OrderStatus.RESERVED,
      OrderStatus.READY,
    ]);
    expect(updateManyArgs.data.status).toBe(OrderStatus.EXPIRED);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledTimes(1);
  });
});
