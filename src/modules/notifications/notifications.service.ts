import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { paginate } from '../../common/dto/pagination.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { EmailGateway } from '../../infrastructure/email/email.gateway';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';

export type NotificationType =
  | 'ORDER_RESERVED'
  | 'ORDER_EXPIRING'
  | 'RESERVATION_EXPIRING'
  | 'ORDER_READY'
  | 'ORDER_COMPLETED'
  | 'NEW_NEARBY_OFFER'
  | 'FAVORITE_BUSINESS_NEW_OFFER'
  | 'OFFER_EXPIRING_SOON'
  | 'PRICE_ANOMALY'
  | 'DEAL_ALERT_MATCH'
  | 'BUSINESS_VERIFIED'
  | 'SYSTEM';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Prisma.InputJsonValue;
}

@Injectable()
export class NotificationsService {
  private readonly frontendOrigin: string;

  constructor(
    private readonly emailGateway: EmailGateway,
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.frontendOrigin = config
      .get<string>('FRONTEND_URL', 'http://localhost:3000')
      .split(',')[0]
      .trim();
  }

  async create(input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.data,
      },
    });
  }

  async list(userId: string, query: ListNotificationsDto) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      readAt: query.unreadOnly ? null : undefined,
    };
    const [notifications, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return paginate(notifications, total, query);
  }

  async markAsRead(userId: string, notificationId: string) {
    const updated = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (updated.count === 0) {
      const notification = await this.prisma.notification.findFirst({
        where: { id: notificationId, userId },
        select: { id: true },
      });
      if (!notification) throw this.notFound();
    }
    return { id: notificationId, read: true };
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updatedCount: result.count };
  }

  async sendEmailVerification(
    email: string,
    fullName: string,
    token: string,
  ): Promise<void> {
    const url = this.createFrontendUrl('/verify-email', token);
    const safeName = this.escapeHtml(fullName);
    await this.emailGateway.send({
      to: email,
      subject: 'Qolmasin — emailingizni tasdiqlang',
      text: `Salom, ${fullName}. Emailingizni tasdiqlash uchun havolani oching: ${url}`,
      html: `<p>Salom, ${safeName}.</p><p>Emailingizni tasdiqlash uchun <a href="${url}">ushbu havolani oching</a>.</p>`,
    });
  }

  async sendPasswordReset(
    email: string,
    fullName: string,
    token: string,
  ): Promise<void> {
    const url = this.createFrontendUrl('/reset-password', token);
    const safeName = this.escapeHtml(fullName);
    await this.emailGateway.send({
      to: email,
      subject: 'Qolmasin — parolni tiklash',
      text: `Salom, ${fullName}. Parolni tiklash uchun havolani oching: ${url}. Agar bu so‘rovni siz yubormagan bo‘lsangiz, xabarni e’tiborsiz qoldiring.`,
      html: `<p>Salom, ${safeName}.</p><p>Parolni tiklash uchun <a href="${url}">ushbu havolani oching</a>.</p><p>Agar bu so‘rovni siz yubormagan bo‘lsangiz, xabarni e’tiborsiz qoldiring.</p>`,
    });
  }

  async sendPasswordChanged(email: string, fullName: string): Promise<void> {
    const safeName = this.escapeHtml(fullName);
    await this.emailGateway.send({
      to: email,
      subject: 'Qolmasin — parol o‘zgartirildi',
      text: `Salom, ${fullName}. Hisobingiz paroli o‘zgartirildi. Agar buni siz qilmagan bo‘lsangiz, qo‘llab-quvvatlash xizmatiga murojaat qiling.`,
      html: `<p>Salom, ${safeName}.</p><p>Hisobingiz paroli o‘zgartirildi.</p><p>Agar buni siz qilmagan bo‘lsangiz, qo‘llab-quvvatlash xizmatiga murojaat qiling.</p>`,
    });
  }

  private createFrontendUrl(path: string, token: string): string {
    const url = new URL(path, this.frontendOrigin);
    url.searchParams.set('token', token);
    return url.toString();
  }

  private escapeHtml(value: string): string {
    return value.replace(
      /[&<>'"]/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;',
        })[character] ?? character,
    );
  }

  private notFound() {
    return new AppException(
      HttpStatus.NOT_FOUND,
      'NOTIFICATION_NOT_FOUND',
      'Notification not found',
    );
  }
}
