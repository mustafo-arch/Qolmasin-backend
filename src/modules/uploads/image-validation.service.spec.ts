import { ConfigService } from '@nestjs/config';
import { ImageValidationService } from './image-validation.service';

describe('ImageValidationService', () => {
  const service = new ImageValidationService(
    new ConfigService({ UPLOAD_MAX_BYTES: 5_242_880 }),
  );

  it('accepts a genuine PNG signature', () => {
    const buffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );
    expect(
      service.validate({
        buffer,
        size: buffer.length,
        mimetype: 'image/png',
        originalname: 'untrusted-name.png',
      }),
    ).toEqual({ mimeType: 'image/png', extension: 'png' });
  });

  it('rejects spoofed MIME metadata', () => {
    const buffer = Buffer.from('<svg><script>alert(1)</script></svg>');
    expect(() =>
      service.validate({
        buffer,
        size: buffer.length,
        mimetype: 'image/png',
        originalname: 'image.png',
      }),
    ).toThrow('Only genuine JPEG, PNG, and WebP images are accepted');
  });
});
