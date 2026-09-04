import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { RequestContext } from '../../common/decorators/request-context.decorator';
import type { RequestContextData } from '../../common/decorators/request-context.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadProductImageDto } from './dto/upload-product-image.dto';
import { StorageService } from './storage.service';
import type { UploadedImageFile } from './upload-file.types';
import { UploadsService } from './uploads.service';

@Controller({
  path: 'businesses/:businessId/products/:productId/images',
  version: '1',
})
@ApiTags('Product Images')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a validated product image' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5_242_880, files: 1, fields: 5 },
    }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @UploadedFile() file: UploadedImageFile | undefined,
    @Body() dto: UploadProductImageDto,
    @RequestContext() context: RequestContextData,
  ) {
    return this.uploads.uploadProductImage(
      user,
      businessId,
      productId,
      file,
      dto,
      context,
    );
  }

  @Delete(':imageId')
  @ApiOperation({ summary: 'Delete an owned product image' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @RequestContext() context: RequestContextData,
  ) {
    return this.uploads.deleteProductImage(
      user,
      businessId,
      productId,
      imageId,
      context,
    );
  }
}

@Controller({ path: 'media', version: '1' })
@ApiTags('Media')
export class MediaController {
  constructor(private readonly storage: StorageService) {}

  @Get(':storageKey')
  @ApiOperation({ summary: 'Read local development media' })
  async read(
    @Param('storageKey') storageKey: string,
    @Res() response: Response,
  ) {
    const file = await this.storage.readLocal(storageKey);
    const extension = storageKey.split('.').at(-1);
    const mimeType =
      extension === 'jpg'
        ? 'image/jpeg'
        : extension === 'png'
          ? 'image/png'
          : 'image/webp';
    response.setHeader('content-type', mimeType);
    response.setHeader('content-length', file.length);
    response.setHeader('cache-control', 'public, max-age=31536000, immutable');
    response.setHeader('x-content-type-options', 'nosniff');
    response.send(file);
  }
}
