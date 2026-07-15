import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { CONFIG_KEYS, MIME_EXTENSION_MAP } from '../../../config/constants';
import { FileStoragePort } from '../domain/file-storage.port';

@Injectable()
export class LocalFileStorageAdapter
  extends FileStoragePort
  implements OnModuleInit
{
  private readonly uploadDir: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.uploadDir =
      this.configService.get<string>(CONFIG_KEYS.UPLOAD_DIR) ?? './uploads';
  }

  async onModuleInit(): Promise<void> {
    await mkdir(this.uploadDir, { recursive: true });
  }

  async save(
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ storageKey: string }> {
    const extension = MIME_EXTENSION_MAP[mimeType] ?? '';
    const storageKey = `${randomUUID()}${extension}`;
    const fullPath = join(this.uploadDir, storageKey);

    await writeFile(fullPath, buffer);

    return { storageKey };
  }

  async read(storageKey: string): Promise<Buffer> {
    const fullPath = join(this.uploadDir, storageKey);
    return readFile(fullPath);
  }
}
