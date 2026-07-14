import * as os from 'os';
import * as path from 'path';
import { existsSync } from 'fs';
import { ConfigService } from '@nestjs/config';
import { LocalFileStorageAdapter } from '../../../src/modules/documents/infrastructure/local-file-storage.adapter';

describe('LocalFileStorageAdapter (integration)', () => {
  let adapter: LocalFileStorageAdapter;
  let uploadDir: string;

  beforeAll(async () => {
    uploadDir = path.join(os.tmpdir(), `legal-test-uploads-${Date.now()}`);

    const configService = {
      get: (key: string) => (key === 'UPLOAD_DIR' ? uploadDir : undefined),
    } as unknown as ConfigService;

    adapter = new LocalFileStorageAdapter(configService);
    await adapter.onModuleInit();
  });

  it('onModuleInit creates the upload directory', () => {
    expect(existsSync(uploadDir)).toBe(true);
  });

  it('save PDF buffer returns storageKey ending with .pdf and file exists on disk', async () => {
    const buffer = Buffer.from('%PDF-1.4 test content');

    const { storageKey } = await adapter.save(buffer, 'application/pdf');

    expect(storageKey).toMatch(/\.pdf$/);
    expect(existsSync(path.join(uploadDir, storageKey))).toBe(true);
  });

  it('save JPEG buffer returns storageKey ending with .jpg and file exists on disk', async () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

    const { storageKey } = await adapter.save(buffer, 'image/jpeg');

    expect(storageKey).toMatch(/\.jpg$/);
    expect(existsSync(path.join(uploadDir, storageKey))).toBe(true);
  });

  it('save PNG buffer returns storageKey ending with .png', async () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

    const { storageKey } = await adapter.save(buffer, 'image/png');

    expect(storageKey).toMatch(/\.png$/);
    expect(existsSync(path.join(uploadDir, storageKey))).toBe(true);
  });

  it('read returns the same buffer that was saved', async () => {
    const original = Buffer.from('read-back-test-data-unique-12345');

    const { storageKey } = await adapter.save(original, 'application/pdf');
    const retrieved = await adapter.read(storageKey);

    expect(retrieved).toEqual(original);
  });

  it('read throws for a missing storageKey', async () => {
    await expect(
      adapter.read('nonexistent-file-that-does-not-exist.pdf'),
    ).rejects.toThrow();
  });
});
