import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const createService = (prisma: unknown) =>
    new NotificationsService(
      {} as never,
      prisma as PrismaService,
      new ConfigService({ FRONTEND_URL: 'http://localhost:3000' }),
    );

  it('creates an in-app notification', async () => {
    const notification = {
      id: 'notification-id',
      userId: 'user-id',
      type: 'ORDER_COMPLETED',
      title: 'Order completed',
      message: 'Your order is complete',
      data: { orderId: 'order-id' },
    };
    const prisma = {
      notification: { create: jest.fn().mockResolvedValue(notification) },
    };
    const service = createService(prisma);

    await expect(
      service.create({
        userId: 'user-id',
        type: 'ORDER_COMPLETED',
        title: 'Order completed',
        message: 'Your order is complete',
        data: { orderId: 'order-id' },
      }),
    ).resolves.toEqual(notification);
  });

  it("marks only the current user's notification as read", async () => {
    const prisma = {
      notification: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = createService(prisma);

    await expect(
      service.markAsRead('user-id', 'notification-id'),
    ).resolves.toEqual({ id: 'notification-id', read: true });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'notification-id', userId: 'user-id', readAt: null },
      }),
    );
  });

  it("returns not found for another user's notification", async () => {
    const prisma = {
      notification: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const service = createService(prisma);

    await expect(
      service.markAsRead('user-id', 'notification-id'),
    ).rejects.toMatchObject({
      response: { code: 'NOTIFICATION_NOT_FOUND' },
      status: 404,
    });
  });
});
