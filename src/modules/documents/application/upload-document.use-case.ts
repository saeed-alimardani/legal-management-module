import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, DocumentType, EntityType } from '@prisma/client';
import { APP_CONSTANTS } from '../../../config/constants';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { FileStoragePort } from '../domain/file-storage.port';
import { PrismaDocumentRepository } from '../infrastructure/prisma-document.repository';
import {
  countParentRefs,
  getDocumentResponseTimeZone,
  normalizeParentRef,
  toDocumentResponse,
} from './document.helpers';

export interface UploadDocumentCommand {
  fileName: string;
  mimeType: string;
  fileSize: number;
  buffer: Buffer;
  documentType: DocumentType;
  description?: string | null;
  caseId?: string | null;
  contractId?: string | null;
  noticeId?: string | null;
}

@Injectable()
export class UploadDocumentUseCase {
  constructor(
    private readonly documentRepository: PrismaDocumentRepository,
    private readonly fileStorage: FileStoragePort,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, command: UploadDocumentCommand) {
    this.accessControl.assertCanMutate(user);

    const parentRef = normalizeParentRef({
      caseId: command.caseId,
      contractId: command.contractId,
      noticeId: command.noticeId,
    });

    if (countParentRefs(parentRef) !== 1) {
      throw new BadRequestException(
        'Exactly one of caseId, contractId, or noticeId is required',
      );
    }

    if (command.fileSize > APP_CONSTANTS.MAX_UPLOAD_SIZE_BYTES) {
      throw new PayloadTooLargeException(
        `File exceeds maximum size of ${APP_CONSTANTS.MAX_UPLOAD_SIZE_BYTES} bytes`,
      );
    }

    if (
      !(APP_CONSTANTS.ALLOWED_MIME_TYPES as readonly string[]).includes(
        command.mimeType,
      )
    ) {
      throw new BadRequestException(
        `Unsupported file type: ${command.mimeType}`,
      );
    }

    const parent = await this.documentRepository.findParentOwner(parentRef);

    if (!parent) {
      throw new NotFoundException('Parent matter not found');
    }

    this.accessControl.assertCanEdit(user, { ownerId: parent.ownerId });

    const { storageKey } = await this.fileStorage.save(
      command.buffer,
      command.mimeType,
    );

    const document = await this.documentRepository.create({
      fileName: command.fileName,
      mimeType: command.mimeType,
      fileSize: command.fileSize,
      storageKey,
      documentType: command.documentType,
      description: command.description,
      uploadedById: user.id,
      caseId: parentRef.caseId,
      contractId: parentRef.contractId,
      noticeId: parentRef.noticeId,
    });

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.DOCUMENT_UPLOADED,
      entityType: EntityType.DOCUMENT,
      entityId: document.id,
      metadata: {
        fileName: document.fileName,
        mimeType: document.mimeType,
        caseId: document.caseId,
        contractId: document.contractId,
        noticeId: document.noticeId,
      },
    });

    const timeZone = getDocumentResponseTimeZone(this.configService);
    return buildSingleResponse(toDocumentResponse(document, timeZone));
  }
}
