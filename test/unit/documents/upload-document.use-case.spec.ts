import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import {
  AuditAction,
  DocumentType,
  EntityType,
  UserRole,
} from '@prisma/client';
import { APP_CONSTANTS } from '../../../src/config/constants';
import { UploadDocumentUseCase } from '../../../src/modules/documents/application/upload-document.use-case';
import { FileStoragePort } from '../../../src/modules/documents/domain/file-storage.port';
import { DocumentWithParent } from '../../../src/modules/documents/domain/document.types';
import { PrismaDocumentRepository } from '../../../src/modules/documents/infrastructure/prisma-document.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('UploadDocumentUseCase', () => {
  let useCase: UploadDocumentUseCase;
  let documentRepository: jest.Mocked<
    Pick<PrismaDocumentRepository, 'create' | 'findParentOwner'>
  >;
  let fileStorage: jest.Mocked<Pick<FileStoragePort, 'save' | 'read'>>;
  let activityLogService: jest.Mocked<Pick<ActivityLogService, 'log'>>;

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  const otherCounsel: AuthenticatedUser = {
    id: 'other-counsel-id',
    email: 'other@legal.local',
    fullName: 'Other Counsel',
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
  const storageKey = 'uploads/uuid-1.pdf';

  const createdDocument: DocumentWithParent = {
    id: 'doc-1',
    fileName: 'contract.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
    storageKey,
    documentType: DocumentType.CONTRACT,
    description: null,
    uploadedById: counsel.id,
    caseId: 'case-1',
    contractId: null,
    noticeId: null,
    deletedAt: null,
    uploadedAt,
    legalCase: { ownerId: counsel.id, deletedAt: null },
    contract: null,
    notice: null,
  };

  const validCommand = {
    fileName: 'contract.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
    buffer: Buffer.from('pdf content'),
    documentType: DocumentType.CONTRACT,
    caseId: 'case-1',
  };

  beforeEach(() => {
    documentRepository = {
      create: jest.fn().mockResolvedValue(createdDocument),
      findParentOwner: jest.fn().mockResolvedValue({ ownerId: counsel.id }),
    };

    fileStorage = {
      save: jest.fn().mockResolvedValue({ storageKey }),
      read: jest.fn(),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new UploadDocumentUseCase(
      documentRepository as unknown as PrismaDocumentRepository,
      fileStorage as unknown as FileStoragePort,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
    );
  });

  it('saves file, creates document, and logs DOCUMENT_UPLOADED', async () => {
    const result = await useCase.execute(counsel, validCommand);

    expect(fileStorage.save).toHaveBeenCalledWith(
      validCommand.buffer,
      validCommand.mimeType,
    );
    expect(documentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'contract.pdf',
        mimeType: 'application/pdf',
        storageKey,
        uploadedById: counsel.id,
        caseId: 'case-1',
      }),
    );
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: counsel.id,
        action: AuditAction.DOCUMENT_UPLOADED,
        entityType: EntityType.DOCUMENT,
        entityId: 'doc-1',
      }),
    );
    expect(result.data.id).toBe('doc-1');
    expect(result.data).not.toHaveProperty('deletedAt');
  });

  it('throws 400 when no parent FK provided', async () => {
    await expect(
      useCase.execute(counsel, {
        ...validCommand,
        caseId: undefined,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 400 when multiple parent FKs provided', async () => {
    await expect(
      useCase.execute(counsel, {
        ...validCommand,
        caseId: 'case-1',
        contractId: 'contract-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws PayloadTooLargeException when file exceeds max size', async () => {
    await expect(
      useCase.execute(counsel, {
        ...validCommand,
        fileSize: APP_CONSTANTS.MAX_UPLOAD_SIZE_BYTES + 1,
      }),
    ).rejects.toThrow(PayloadTooLargeException);
  });

  it('throws BadRequestException for unsupported MIME type', async () => {
    await expect(
      useCase.execute(counsel, {
        ...validCommand,
        mimeType: 'application/zip',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 404 when parent matter is missing', async () => {
    documentRepository.findParentOwner.mockResolvedValue(null);

    await expect(useCase.execute(counsel, validCommand)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws 403 when counsel uploads to another counsels case', async () => {
    documentRepository.findParentOwner.mockResolvedValue({
      ownerId: otherCounsel.id,
    });

    await expect(useCase.execute(counsel, validCommand)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws 403 when viewer attempts upload', async () => {
    await expect(useCase.execute(viewer, validCommand)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows manager to upload to any case', async () => {
    documentRepository.findParentOwner.mockResolvedValue({
      ownerId: counsel.id,
    });
    documentRepository.create.mockResolvedValue({
      ...createdDocument,
      uploadedById: manager.id,
    });

    const result = await useCase.execute(manager, validCommand);

    expect(result.data.id).toBe('doc-1');
    expect(fileStorage.save).toHaveBeenCalled();
  });

  it('accepts contract as parent', async () => {
    const contractDoc: DocumentWithParent = {
      ...createdDocument,
      caseId: null,
      contractId: 'contract-1',
      legalCase: null,
      contract: { ownerId: counsel.id, deletedAt: null },
    };
    documentRepository.create.mockResolvedValue(contractDoc);

    const result = await useCase.execute(counsel, {
      ...validCommand,
      caseId: undefined,
      contractId: 'contract-1',
    });

    expect(documentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ contractId: 'contract-1', caseId: null }),
    );
    expect(result.data.contractId).toBe('contract-1');
  });

  it('normalizes empty sibling parent FKs from multipart forms', async () => {
    await useCase.execute(counsel, {
      ...validCommand,
      caseId: 'case-1',
      contractId: '',
      noticeId: '',
    });

    expect(documentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'case-1',
        contractId: null,
        noticeId: null,
      }),
    );
  });

  it('accepts notice as parent', async () => {
    const noticeDoc: DocumentWithParent = {
      ...createdDocument,
      caseId: null,
      noticeId: 'notice-1',
      legalCase: null,
      notice: { ownerId: counsel.id, deletedAt: null },
    };
    documentRepository.create.mockResolvedValue(noticeDoc);

    const result = await useCase.execute(counsel, {
      ...validCommand,
      caseId: undefined,
      noticeId: 'notice-1',
    });

    expect(documentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ noticeId: 'notice-1' }),
    );
    expect(result.data.noticeId).toBe('notice-1');
  });

  it('logs metadata with correct parent FK', async () => {
    await useCase.execute(counsel, validCommand);

    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          fileName: 'contract.pdf',
          mimeType: 'application/pdf',
          caseId: 'case-1',
        }),
      }),
    );
  });
});
