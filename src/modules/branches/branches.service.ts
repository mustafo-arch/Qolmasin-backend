import { HttpStatus, Injectable } from '@nestjs/common';
import { Branch, Prisma } from '@prisma/client';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { BusinessAccessService } from '../business-members/business-access.service';
import { BusinessPermission } from '../business-members/business-permission.enum';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BusinessAccessService,
  ) {}

  async create(userId: string, businessId: string, dto: CreateBranchDto) {
    await this.access.requireManager(
      userId,
      businessId,
      BusinessPermission.BRANCH_WRITE,
    );
    this.validateTimeZone(dto.timezone);
    this.validateHours(dto.openingTime, dto.closingTime);
    const branch = await this.prisma.branch.create({
      data: {
        businessId,
        name: dto.name,
        address: dto.address,
        countryCode: dto.countryCode,
        region: dto.region,
        city: dto.city,
        district: dto.district,
        latitude: new Prisma.Decimal(dto.latitude),
        longitude: new Prisma.Decimal(dto.longitude),
        phone: dto.phone,
        timezone: dto.timezone,
        currency: dto.currency,
        openingTime: dto.openingTime,
        closingTime: dto.closingTime,
      },
    });
    return this.toResponse(branch);
  }

  async listManaged(
    userId: string,
    businessId: string,
    pagination: PaginationDto,
  ) {
    await this.access.requireMembership(userId, businessId);
    const where: Prisma.BranchWhereInput = { businessId, deletedAt: null };
    const [branches, total] = await this.prisma.$transaction([
      this.prisma.branch.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.branch.count({ where }),
    ]);
    return paginate(
      branches.map((branch) => this.toResponse(branch)),
      total,
      pagination,
    );
  }

  async getPublic(branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        status: 'ACTIVE',
        deletedAt: null,
        business: { status: 'VERIFIED', deletedAt: null },
      },
      include: { business: { select: { id: true, name: true, slug: true } } },
    });
    if (!branch) throw this.notFound();
    return { ...this.toResponse(branch), business: branch.business };
  }

  async update(
    userId: string,
    businessId: string,
    branchId: string,
    dto: UpdateBranchDto,
  ) {
    await this.access.requireManager(
      userId,
      businessId,
      BusinessPermission.BRANCH_WRITE,
    );
    const existing = await this.prisma.branch.findFirst({
      where: { id: branchId, businessId, deletedAt: null },
    });
    if (!existing) throw this.notFound();
    if (
      existing.status === 'ARCHIVED' &&
      dto.status &&
      dto.status !== 'ARCHIVED'
    ) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'BRANCH_ARCHIVED',
        'Archived branches cannot be reactivated',
      );
    }

    const timezone = dto.timezone ?? existing.timezone;
    const openingTime = dto.openingTime ?? existing.openingTime ?? undefined;
    const closingTime = dto.closingTime ?? existing.closingTime ?? undefined;
    this.validateTimeZone(timezone);
    this.validateHours(openingTime, closingTime);

    const branch = await this.prisma.branch.update({
      where: { id: existing.id },
      data: {
        name: dto.name,
        address: dto.address,
        countryCode: dto.countryCode,
        region: dto.region,
        city: dto.city,
        district: dto.district,
        latitude:
          dto.latitude === undefined
            ? undefined
            : new Prisma.Decimal(dto.latitude),
        longitude:
          dto.longitude === undefined
            ? undefined
            : new Prisma.Decimal(dto.longitude),
        phone: dto.phone,
        timezone: dto.timezone,
        currency: dto.currency,
        openingTime: dto.openingTime,
        closingTime: dto.closingTime,
        status: dto.status,
      },
    });
    return this.toResponse(branch);
  }

  private validateTimeZone(timezone: string): void {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    } catch {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'BRANCH_INVALID_TIMEZONE',
        'Invalid IANA timezone',
      );
    }
  }

  private validateHours(openingTime?: string, closingTime?: string): void {
    if (!openingTime && !closingTime) return;
    if (!openingTime || !closingTime || openingTime === closingTime) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'BRANCH_INVALID_HOURS',
        'Opening and closing times must both be provided and be different',
      );
    }
  }

  private toResponse(branch: Branch) {
    return {
      id: branch.id,
      businessId: branch.businessId,
      name: branch.name,
      address: branch.address,
      countryCode: branch.countryCode,
      region: branch.region,
      city: branch.city,
      district: branch.district,
      latitude: branch.latitude.toNumber(),
      longitude: branch.longitude.toNumber(),
      phone: branch.phone,
      timezone: branch.timezone,
      currency: branch.currency,
      status: branch.status,
      openingTime: branch.openingTime,
      closingTime: branch.closingTime,
      createdAt: branch.createdAt,
      updatedAt: branch.updatedAt,
    };
  }

  private notFound() {
    return new AppException(
      HttpStatus.NOT_FOUND,
      'BRANCH_NOT_FOUND',
      'Branch not found',
    );
  }
}
