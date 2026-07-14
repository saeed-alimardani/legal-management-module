import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  DocumentType,
  EntityType,
  UserRole,
} from '@prisma/client';
import { DeleteDocumentUseCase } from '../../../src/modules/documents/application/delete-document.use-case';
import { DocumentWithParent } from '../../../src/modules/documents/domain/document.types';
import { PrismaDocumentRepository } from '../../../src/modules/documents/infrastructure/prisma-document.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('DeleteDocumentUseCase', () => {
  let useCase: DeleteDocumentUseCase;
  let documentRepository: jest.Mocked<
    Pick<PrismaDocumentRepository, 'findById' | 'softDelete'>
  >;
  let activityLogService: jest.Mocked<Pick<ActivityLogService, 'log'>>;

  const uploader: AuthenticatedUser = {
    id: 'uploader-id',
    email: 'uploader@legal.local',
    fullName: 'Uploader',
    role: UserRole.LEGAL_COUNSEL,
  };

  const parentOwner: AuthenticatedUser = {
    id: 'owner-id',
    email: 'owner@legal.local',
    fullName: 'Owner',
    role: UserRole.LEGAL_COUNSEL,
  };

  const manager: AuthenticatedUser = {
    id: 'manager-id',
    email: 'manager@legal.local',
    fullName: 'Manager',
    role: UserRole.LEGAL_MANAGER,
  };

  const viewer: AuthenticatedUser = {
    id: 'viewer-id',
    email: 'viewer@legal.local',
    fullName: 'Viewer',
    role: UserRole.VIEWER,
  };

  const uploadedAt = new Date('2026-07-14T10:00:00.000Z');

  const existingDocument: DocumentWithParent = {
    id: 'doc-1',
    fileName: 'contract.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
    storageKey: 'uploads/uuid-1.pdf',
    documentType: DocumentType.CONTRACT,
    description: null,
    uploadedById: uploader.id,
    caseId: 'case-1',
    contractId: null,
    noticeId: null,
    deletedAt: null,
    uploadedAt,
    legalCase: { ownerId: parentOwner.id, deletedAt: null },
    contract: null,
    notice: null,
  };

  beforeEach(() => {
    documentRepository = {
      findById: jest.fn().mockResolvedValue(existingDocument),
      softDelete: jest
        .fn()
        .mockResolvedValue({ ...existingDocument, deletedAt: new Date() }),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new DeleteDocumentUseCase(
      documentRepository as unknown as PrismaDocumentRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
    );
  });

  it('allows uploader to delete own document and logs DELETED', async () => {
    const result = await useCase.execute(uploader, 'doc-1');

    expect(documentRepository.softDelete).toHaveBeenCalledWith('doc-1');
    expect(activityLogService.log).toHaveBeenCalledWith({
      actorId: uploader.id,
      action: AuditAction.DELETED,
      entityType: EntityType.DOCUMENT,
      entityId: 'doc-1',
      metadata: { fileName: 'contract.pdf' },
    });
    expect(result.data).toEqual({ success: true });
  });

  it('allows manager to delete any document', async () => {
    const result = await useCase.execute(manager, 'doc-1');

    expect(documentRepository.softDelete).toHaveBeenCalledWith('doc-1');
    expect(result.data).toEqual({ success: true });
  });

  it('throws 403 when counsel is parent owner but not uploader', async () => {
    // parentOwner owns the case but did not upload the document
    await expect(useCase.execute(parentOwner, 'doc-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(documentRepository.softDelete).not.toHaveBeenCalled();
  });

  it('throws 403 when viewer attempts delete', async () => {
    await expect(useCase.execute(viewer, 'doc-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(documentRepository.softDelete).not.toHaveBeenCalled();
  });

  it('throws 404 when document does not exist', async () => {
    documentRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(uploader, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws 404 when document has no resolvable parent (deleted parent)', async () => {
    documentRepository.findById.mockResolvedValue({
      ...existingDocument,
      legalCase: { ownerId: parentOwner.id, deletedAt: new Date() },
      contract: null,
      notice: null,
    });

    await expect(useCase.execute(uploader, 'doc-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('does not call softDelete when access check fails', async () => {
    await expect(useCase.execute(viewer, 'doc-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(documentRepository.softDelete).not.toHaveBeenCalled();
    expect(activityLogService.log).not.toHaveBeenCalled();
  });
});
