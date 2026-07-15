import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType } from '@prisma/client';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaDocumentRepository } from '../infrastructure/prisma-document.repository';
import { resolveParentOwnerId } from './document.helpers';

@Injectable()
export class DeleteDocumentUseCase {
  constructor(
    private readonly documentRepository: PrismaDocumentRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async execute(user: AuthenticatedUser, documentId: string) {
    this.accessControl.assertCanCreateMatterContent(user);

    const existing = await this.documentRepository.findById(documentId);

    if (!existing) {
      throw new NotFoundException('Document not found');
    }

    const parentOwnerId = resolveParentOwnerId(existing);

    if (!parentOwnerId) {
      throw new NotFoundException('Document not found');
    }

    this.accessControl.assertCanDeleteDocument(user, {
      uploadedById: existing.uploadedById,
    });

    await this.documentRepository.softDelete(documentId);

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.DELETED,
      entityType: EntityType.DOCUMENT,
      entityId: documentId,
      metadata: {
        fileName: existing.fileName,
      },
    });

    return buildSingleResponse({ success: true });
  }
}
