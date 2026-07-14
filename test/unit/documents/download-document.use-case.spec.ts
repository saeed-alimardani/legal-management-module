import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DocumentType, UserRole } from '@prisma/client';
import { DownloadDocumentUseCase } from '../../../src/modules/documents/application/download-document.use-case';
import { FileStoragePort } from '../../../src/modules/documents/domain/file-storage.port';
import { DocumentWithParent } from '../../../src/modules/documents/domain/document.types';
import { PrismaDocumentRepository } from '../../../src/modules/documents/infrastructure/prisma-document.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('DownloadDocumentUseCase', () => {
  let useCase: DownloadDocumentUseCase;
  let documentRepository: jest.Mocked<
    Pick<PrismaDocumentRepository, 'findById'>
  >;
  let fileStorage: jest.Mocked<Pick<FileStoragePort, 'save' | 'read'>>;

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

  const viewer: AuthenticatedUser = {
    id: 'viewer-id',
    email: 'viewer@legal.local',
    fullName: 'Viewer',
    role: UserRole.VIEWER,
  };

  const storageKey = 'uploads/uuid-1.pdf';
  const fileBuffer = Buffer.from('pdf content bytes');
  const uploadedAt = new Date('2026-07-14T10:00:00.000Z');

  const existingDocument: DocumentWithParent = {
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

  beforeEach(() => {
    documentRepository = {
      findById: jest.fn().mockResolvedValue(existingDocument),
    };

    fileStorage = {
      save: jest.fn(),
      read: jest.fn().mockResolvedValue(fileBuffer),
    };

    useCase = new DownloadDocumentUseCase(
      documentRepository as unknown as PrismaDocumentRepository,
      fileStorage as unknown as FileStoragePort,
      new AccessControlService(),
    );
  });

  it('returns buffer, fileName, and mimeType for authorized user', async () => {
    const result = await useCase.execute(counsel, 'doc-1');

    expect(result.buffer).toBe(fileBuffer);
    expect(result.fileName).toBe('contract.pdf');
    expect(result.mimeType).toBe('application/pdf');
  });

  it('calls fileStorage.read with document storageKey', async () => {
    await useCase.execute(counsel, 'doc-1');

    expect(fileStorage.read).toHaveBeenCalledWith(storageKey);
  });

  it('allows viewer to download document', async () => {
    const result = await useCase.execute(viewer, 'doc-1');

    expect(result.buffer).toBe(fileBuffer);
    expect(fileStorage.read).toHaveBeenCalledWith(storageKey);
  });

  it('throws 403 for unrelated counsel', async () => {
    await expect(useCase.execute(otherCounsel, 'doc-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(fileStorage.read).not.toHaveBeenCalled();
  });

  it('throws 404 when document does not exist', async () => {
    documentRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(counsel, 'missing')).rejects.toThrow(
      NotFoundException,
    );
    expect(fileStorage.read).not.toHaveBeenCalled();
  });

  it('throws 404 when parent case is soft-deleted', async () => {
    documentRepository.findById.mockResolvedValue({
      ...existingDocument,
      legalCase: { ownerId: counsel.id, deletedAt: new Date() },
      contract: null,
      notice: null,
    });

    await expect(useCase.execute(counsel, 'doc-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(fileStorage.read).not.toHaveBeenCalled();
  });

  it('throws 404 when all parent refs are null', async () => {
    documentRepository.findById.mockResolvedValue({
      ...existingDocument,
      legalCase: null,
      contract: null,
      notice: null,
    });

    await expect(useCase.execute(counsel, 'doc-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('reads file from contract parent when legalCase is null', async () => {
    documentRepository.findById.mockResolvedValue({
      ...existingDocument,
      caseId: null,
      contractId: 'contract-1',
      legalCase: null,
      contract: { ownerId: counsel.id, deletedAt: null },
    });

    const result = await useCase.execute(counsel, 'doc-1');

    expect(fileStorage.read).toHaveBeenCalledWith(storageKey);
    expect(result.buffer).toBe(fileBuffer);
  });
});
