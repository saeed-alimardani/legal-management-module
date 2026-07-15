import { Injectable, NotFoundException } from '@nestjs/common';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { FileStoragePort } from '../domain/file-storage.port';
import { PrismaDocumentRepository } from '../infrastructure/prisma-document.repository';
import { resolveParentOwnerId } from './document.helpers';

export interface DownloadDocumentResult {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

@Injectable()
export class DownloadDocumentUseCase {
  constructor(
    private readonly documentRepository: PrismaDocumentRepository,
    private readonly fileStorage: FileStoragePort,
    private readonly accessControl: AccessControlService,
  ) {}

  async execute(
    user: AuthenticatedUser,
    documentId: string,
  ): Promise<DownloadDocumentResult> {
    const document = await this.documentRepository.findById(documentId);

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const parentOwnerId = resolveParentOwnerId(document);

    if (!parentOwnerId) {
      throw new NotFoundException('Document not found');
    }

    const involved = await this.documentRepository.isUserInvolved(
      documentId,
      user.id,
    );
    this.accessControl.assertCanViewMatter(user, parentOwnerId, involved);

    const buffer = await this.fileStorage.read(document.storageKey);

    return {
      buffer,
      fileName: document.fileName,
      mimeType: document.mimeType,
    };
  }
}
