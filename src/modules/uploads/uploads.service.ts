import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequestContextData } from '../../common/decorators/request-context.decorator';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditAction, AuditEntityType } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { BusinessAccessService } from '../business-members/business-access.service';
import { BusinessPermission } from '../business-members/business-permission.enum';
import { UploadProductImageDto } from './dto/upload-product-image.dto';
import { ImageValidationService } from './image-validation.service';
import { StorageService } from './storage.service';
import { UploadedImageFile } from './upload-file.types';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly imageLimit: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BusinessAccessService,
    private readonly imageValidation: ImageValidationService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.imageLimit = config.get<number>('PRODUCT_IMAGE_LIMIT', 5);
  }

  async uploadProductImage(
    actor: AuthenticatedUser,
    businessId: string,
    productId: string,
    file: UploadedImageFile | undefined,
    dto: UploadProductImageDto,
    context: RequestContextData = {},
  ) {
    await this.access.requireManager(
      actor.sub,
      businessId,
      BusinessPermission.PRODUCT_WRITE,
    );
    const product = await this.prisma.product.findFirst({
      where: { id: productId, businessId, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw this.productNotFound();
    const imageCount = await this.prisma.productImage.count({
      where: { productId },
    });
    if (imageCount >= this.imageLimit) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'PRODUCT_IMAGE_LIMIT_REACHED',
        'Product image limit has been reached',
      );
    }

    const validated = this.imageValidation.validate(file);
    const stored = await this.storage.putProductImage(
      productId,
      validated,
      file!.buffer,
    );
    try {
      const image = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.productImage.create({
          data: {
            productId,
            url: stored.url,
            storageKey: stored.storageKey,
            mimeType: validated.mimeType,
            size: file!.size,
            sortOrder: dto.sortOrder,
          },
        });
        await this.audit.record(transaction, {
          actorUserId: actor.sub,
          actorRole: actor.role,
          action: AuditAction.PRODUCT_IMAGE_ADDED,
          entityType: AuditEntityType.PRODUCT,
          entityId: productId,
          requestId: context.requestId,
          ip: context.ip,
          metadata: { imageId: created.id, size: created.size },
        });
        return created;
      });
      return this.toResponse(image);
    } catch (error: unknown) {
      await this.storage.delete(stored.storageKey).catch(() => undefined);
      throw error;
    }
  }

  async deleteProductImage(
    actor: AuthenticatedUser,
    businessId: string,
    productId: string,
    imageId: string,
    context: RequestContextData = {},
  ) {
    await this.access.requireManager(
      actor.sub,
      businessId,
      BusinessPermission.PRODUCT_WRITE,
    );
    const image = await this.prisma.productImage.findFirst({
      where: {
        id: imageId,
        productId,
        product: { businessId, deletedAt: null },
      },
    });
    if (!image) throw this.imageNotFound();
    await this.prisma.$transaction(async (transaction) => {
      await transaction.productImage.delete({ where: { id: image.id } });
      await this.audit.record(transaction, {
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: AuditAction.PRODUCT_IMAGE_DELETED,
        entityType: AuditEntityType.PRODUCT,
        entityId: productId,
        requestId: context.requestId,
        ip: context.ip,
        metadata: { imageId: image.id },
      });
    });
    try {
      await this.storage.delete(image.storageKey);
    } catch {
      this.logger.error(`Orphaned storage object: ${image.storageKey}`);
    }
    return { success: true };
  }

  private toResponse(image: {
    id: string;
    url: string;
    mimeType: string;
    size: number;
    sortOrder: number;
    createdAt: Date;
  }) {
    return image;
  }

  private productNotFound() {
    return new AppException(
      HttpStatus.NOT_FOUND,
      'PRODUCT_NOT_FOUND',
      'Product not found',
    );
  }

  private imageNotFound() {
    return new AppException(
      HttpStatus.NOT_FOUND,
      'PRODUCT_IMAGE_NOT_FOUND',
      'Product image not found',
    );
  }
}
