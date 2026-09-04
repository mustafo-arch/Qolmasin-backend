import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../common/exceptions/app.exception';
import { UploadedImageFile, ValidatedImage } from './upload-file.types';

@Injectable()
export class ImageValidationService {
  private readonly maxBytes: number;

  constructor(config: ConfigService) {
    this.maxBytes = config.get<number>('UPLOAD_MAX_BYTES', 5_242_880);
  }

  validate(file?: UploadedImageFile): ValidatedImage {
    if (!file?.buffer?.length) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'UPLOAD_FILE_REQUIRED',
        'An image file is required',
      );
    }
    if (file.size > this.maxBytes || file.buffer.length > this.maxBytes) {
      throw new AppException(
        HttpStatus.PAYLOAD_TOO_LARGE,
        'UPLOAD_FILE_TOO_LARGE',
        'Image exceeds the configured size limit',
      );
    }

    const detected = this.detect(file.buffer);
    if (!detected || detected.mimeType !== file.mimetype.toLowerCase()) {
      throw new AppException(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        'UPLOAD_INVALID_IMAGE_TYPE',
        'Only genuine JPEG, PNG, and WebP images are accepted',
      );
    }
    return detected;
  }

  private detect(buffer: Buffer): ValidatedImage | null {
    if (
      buffer.length >= 4 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff &&
      buffer.at(-2) === 0xff &&
      buffer.at(-1) === 0xd9
    ) {
      return { mimeType: 'image/jpeg', extension: 'jpg' };
    }
    if (
      buffer.length >= 20 &&
      buffer
        .subarray(0, 8)
        .equals(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        ) &&
      buffer
        .subarray(-12)
        .equals(
          Buffer.from([
            0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60,
            0x82,
          ]),
        )
    ) {
      return { mimeType: 'image/png', extension: 'png' };
    }
    if (
      buffer.length >= 16 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP' &&
      buffer.readUInt32LE(4) + 8 === buffer.length &&
      ['VP8 ', 'VP8L', 'VP8X'].includes(
        buffer.subarray(12, 16).toString('ascii'),
      )
    ) {
      return { mimeType: 'image/webp', extension: 'webp' };
    }
    return null;
  }
}
