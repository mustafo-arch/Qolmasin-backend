import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { AppException } from '../../common/exceptions/app.exception';
import { ValidatedImage } from './upload-file.types';

interface StoredObject {
  storageKey: string;
  url: string;
}

@Injectable()
export class StorageService {
  private readonly driver: 'local' | 'supabase';
  private readonly localRoot: string;
  private readonly publicUrl: string;
  private readonly supabaseUrl?: string;
  private readonly serviceRoleKey?: string;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.driver = config.get<'local' | 'supabase'>('STORAGE_DRIVER', 'local');
    this.localRoot = resolve(
      process.cwd(),
      config.get<string>('UPLOAD_LOCAL_DIR', '.local-uploads'),
    );
    this.publicUrl = config
      .get<string>(
        'API_PUBLIC_URL',
        `http://localhost:${config.get<number>('PORT', 3000)}`,
      )
      .replace(/\/$/, '');
    this.supabaseUrl = config.get<string>('SUPABASE_URL')?.replace(/\/$/, '');
    this.serviceRoleKey = config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.bucket = config.get<string>(
      'SUPABASE_STORAGE_BUCKET',
      'product-images',
    );
  }

  async putProductImage(
    productId: string,
    image: ValidatedImage,
    buffer: Buffer,
  ): Promise<StoredObject> {
    const storageKey = `product-${productId}-${randomUUID()}.${image.extension}`;
    if (this.driver === 'supabase') {
      await this.putSupabase(storageKey, image.mimeType, buffer);
      return {
        storageKey,
        url: `${this.supabaseUrl}/storage/v1/object/public/${this.bucket}/${storageKey}`,
      };
    }

    await mkdir(this.localRoot, { recursive: true });
    await writeFile(this.resolveLocalKey(storageKey), buffer, { flag: 'wx' });
    return {
      storageKey,
      url: `${this.publicUrl}/api/v1/media/${storageKey}`,
    };
  }

  async delete(storageKey: string): Promise<void> {
    this.assertStorageKey(storageKey);
    if (this.driver === 'supabase') {
      const response = await fetch(
        `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${storageKey}`,
        {
          method: 'DELETE',
          headers: this.supabaseHeaders(),
        },
      );
      if (!response.ok && response.status !== 404) {
        throw this.storageFailure();
      }
      return;
    }
    try {
      await unlink(this.resolveLocalKey(storageKey));
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  async readLocal(storageKey: string): Promise<Buffer> {
    if (this.driver !== 'local') throw this.notFound();
    this.assertStorageKey(storageKey);
    try {
      return await readFile(this.resolveLocalKey(storageKey));
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw this.notFound();
      }
      throw error;
    }
  }

  private async putSupabase(
    storageKey: string,
    mimeType: string,
    buffer: Buffer,
  ): Promise<void> {
    const response = await fetch(
      `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${storageKey}`,
      {
        method: 'POST',
        headers: {
          ...this.supabaseHeaders(),
          'content-type': mimeType,
          'x-upsert': 'false',
        },
        body: new Uint8Array(buffer),
      },
    );
    if (!response.ok) throw this.storageFailure();
  }

  private supabaseHeaders(): Record<string, string> {
    if (!this.supabaseUrl || !this.serviceRoleKey) throw this.storageFailure();
    return {
      apikey: this.serviceRoleKey,
      authorization: `Bearer ${this.serviceRoleKey}`,
    };
  }

  private resolveLocalKey(storageKey: string): string {
    this.assertStorageKey(storageKey);
    return resolve(this.localRoot, storageKey);
  }

  private assertStorageKey(storageKey: string): void {
    if (
      !/^product-[0-9a-f-]{36}-[0-9a-f-]{36}\.(jpg|png|webp)$/.test(storageKey)
    ) {
      throw this.notFound();
    }
  }

  private storageFailure() {
    return new AppException(
      HttpStatus.SERVICE_UNAVAILABLE,
      'STORAGE_UNAVAILABLE',
      'Image storage is temporarily unavailable',
    );
  }

  private notFound() {
    return new AppException(
      HttpStatus.NOT_FOUND,
      'MEDIA_NOT_FOUND',
      'Media not found',
    );
  }
}
