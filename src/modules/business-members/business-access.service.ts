import { HttpStatus, Injectable } from '@nestjs/common';
import { BusinessMemberRole } from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { BusinessPermission } from './business-permission.enum';

@Injectable()
export class BusinessAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireMembership(
    userId: string,
    businessId: string,
    allowedRoles: BusinessMemberRole[] = [
      BusinessMemberRole.OWNER,
      BusinessMemberRole.MANAGER,
      BusinessMemberRole.STAFF,
    ],
  ) {
    const member = await this.prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId, userId } },
      include: { business: true },
    });
    if (
      !member ||
      member.status !== 'ACTIVE' ||
      !allowedRoles.includes(member.role) ||
      member.business.deletedAt
    ) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'BUSINESS_NOT_FOUND',
        'Business not found',
      );
    }
    if (member.business.status === 'SUSPENDED') {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'BUSINESS_SUSPENDED',
        'Business is suspended',
      );
    }
    return member;
  }

  async requireManager(
    userId: string,
    businessId: string,
    permission?: BusinessPermission,
  ) {
    const member = await this.requireMembership(
      userId,
      businessId,
      permission
        ? [
            BusinessMemberRole.OWNER,
            BusinessMemberRole.MANAGER,
            BusinessMemberRole.STAFF,
          ]
        : [BusinessMemberRole.OWNER, BusinessMemberRole.MANAGER],
    );
    if (
      permission &&
      member.role === BusinessMemberRole.STAFF &&
      !member.permissions.includes(permission)
    ) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'BUSINESS_PERMISSION_REQUIRED',
        'The business member does not have the required permission',
      );
    }
    return member;
  }

  requireOwner(userId: string, businessId: string) {
    return this.requireMembership(userId, businessId, [
      BusinessMemberRole.OWNER,
    ]);
  }
}
