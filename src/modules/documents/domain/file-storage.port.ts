/**
 * The only Port in the project — filesystem may change (e.g. S3 later).
 * No delete() for MVP — soft-delete leaves files on disk.
 */
export abstract class FileStoragePort {
  abstract save(
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ storageKey: string }>;

  abstract read(storageKey: string): Promise<Buffer>;
}
