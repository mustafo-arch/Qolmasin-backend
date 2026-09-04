import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestContextData } from '../../common/decorators/request-context.decorator';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditAction, AuditEntityType } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { BusinessAccessService } from './business-access.service';
import { AddBusinessMemberDto } from './dto/add-business-member.dto';
import { UpdateBusinessMemberDto } from './dto/update-business-member.dto';

@Injectable()
export class BusinessMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BusinessAccessService,
    private readonly audit: AuditService,
  ) {}

  async add(
    actor: AuthenticatedUser,
    businessId: string,
    dto: AddBusinessMemberDto,
    context: RequestContextData = {},
  ) {
    await this.access.requireOwner(actor.sub, businessId);
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (
      !user ||
      user.status !== 'ACTIVE' ||
      user.deletedAt ||
      !user.emailVerifiedAt
    ) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'BUSINESS_MEMBER_USER_NOT_FOUND',
        'An eligible verified user was not found',
      );
    }
    try {
      const member = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.businessMember.create({
          data: {
            businessId,
            userId: user.id,
            role: dto.role,
            permissions: dto.permissions ?? [],
            status: 'ACTIVE',
          },
          include: { user: true },
        });
        await this.audit.record(transaction, {
          actorUserId: actor.sub,
          actorRole: actor.role,
          action: AuditAction.BUSINESS_MEMBER_ADDED,
          entityType: AuditEntityType.BUSINESS,
          entityId: businessId,
          requestId: context.requestId,
          ip: context.ip,
          metadata: {
            memberId: created.id,
            memberUserId: created.userId,
            role: created.role,
            permissions: created.permissions,
          },
        });
        return created;
      });
      return this.toResponse(member);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'BUSINESS_MEMBER_EXISTS',
          'User is already a member of this business',
        );
      }
      throw error;
    }
  }

  async list(userId: string, businessId: string, pagination: PaginationDto) {
    await this.access.requireManager(userId, businessId);
    const where: Prisma.BusinessMemberWhereInput = { businessId };
    const [members, total] = await this.prisma.$transaction([
      this.prisma.businessMember.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'asc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.businessMember.count({ where }),
    ]);
    return paginate(
      members.map((member) => this.toResponse(member)),
      total,
      pagination,
    );
  }

  async update(
    actor: AuthenticatedUser,
    businessId: string,
    memberId: string,
    dto: UpdateBusinessMemberDto,
    context: RequestContextData = {},
  ) {
    await this.access.requireOwner(actor.sub, businessId);
    const member = await this.prisma.businessMember.findFirst({
      where: { id: memberId, businessId },
    });
    if (!member) throw this.memberNotFound();
    if (member.role === 'OWNER') {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'BUSINESS_OWNER_IMMUTABLE',
        'Owner membership cannot be modified',
      );
    }
    const updated = await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.businessMember.update({
        where: { id: member.id },
        data: {
          role: dto.role,
          status: dto.status,
          permissions: dto.permissions,
        },
        include: { user: true },
      });
      const changedFields = Object.entries(dto)
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key);
      await this.audit.record(transaction, {
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: AuditAction.BUSINESS_MEMBER_UPDATED,
        entityType: AuditEntityType.BUSINESS,
        entityId: businessId,
        requestId: context.requestId,
        ip: context.ip,
        metadata: {
          memberId: changed.id,
          memberUserId: changed.userId,
          changedFields,
          role: changed.role,
          status: changed.status,
          permissions: changed.permissions,
        },
      });
      return changed;
    });
    return this.toResponse(updated);
  }

  private toResponse(member: {
    id: string;
    userId: string;
    role: string;
    status: string;
    permissions: string[];
    createdAt: Date;
    user: { fullName: string; email: string | null };
  }) {
    return {
      id: member.id,
      userId: member.userId,
      fullName: member.user.fullName,
      email: member.user.email,
      role: member.role,
      status: member.status,
      permissions: member.permissions,
      createdAt: member.createdAt,
    };
  }

  private memberNotFound() {
    return new AppException(
      HttpStatus.NOT_FOUND,
      'BUSINESS_MEMBER_NOT_FOUND',
      'Business member not found',
    );
  }
}
