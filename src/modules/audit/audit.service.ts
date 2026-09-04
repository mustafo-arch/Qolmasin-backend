import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { paginate } from '../../common/dto/pagination.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

export interface AuditRecordInput {
  actorUserId: string;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  requestId?: string;
  ip?: string;
  metadata?: Prisma.InputJsonObject;
}

@Injectable()
export class AuditService {
  private readonly ipHashSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.ipHashSecret = config.getOrThrow<string>('IP_HASH_SECRET');
  }

  record(transaction: Prisma.TransactionClient, input: AuditRecordInput) {
    return transaction.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        requestId: input.requestId,
        ipHash: this.hashIp(input.ip),
        metadata: input.metadata,
      },
    });
  }

  async list(query: ListAuditLogsDto) {
    if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'AUDIT_INVALID_DATE_RANGE',
        'The audit date range is invalid',
      );
    }
    const where: Prisma.AuditLogWhereInput = {
      action: query.action,
      entityType: query.entityType,
      entityId: query.entityId,
      actorUserId: query.actorUserId,
      createdAt:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
    };
    const [logs, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          actor: { select: { id: true, fullName: true, role: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(logs, total, query);
  }

  private hashIp(ip?: string): string | undefined {
    if (!ip) return undefined;
    return createHmac('sha256', this.ipHashSecret)
      .update(ip.trim().toLowerCase())
      .digest('hex');
  }
}
