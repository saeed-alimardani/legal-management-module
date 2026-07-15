import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentType, UserRole } from '@prisma/client';
import { GetDocumentUseCase } from '../../../src/modules/documents/application/get-document.use-case';
import { DocumentWithParent } from '../../../src/modules/documents/domain/document.types';
import { PrismaDocumentRepository } from '../../../src/modules/documents/infrastructure/prisma-document.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('GetDocumentUseCase', () => {
  let useCase: GetDocumentUseCase;
  let documentRepository: jest.Mocked<
    Pick<PrismaDocumentRepository, 'findById' | 'isUserInvolved'>
  >;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;

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

  const uploadedAt = new Date('2026-07-14T10:00:00.000Z');

  const existingDocument: DocumentWithParent = {
    id: 'doc-1',
    fileName: 'contract.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
    storageKey: 'uploads/uuid-1.pdf',
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
      isUserInvolved: jest.fn().mockResolvedValue(false),
    };

    configService = {
      get: jest.fn().mockReturnValue('Asia/Tehran'),
    };

    useCase = new GetDocumentUseCase(
      documentRepository as unknown as PrismaDocumentRepository,
      new AccessControlService(),
      configService as unknown as ConfigService,
    );
  });

  it('returns document for parent case owner', async () => {
    const result = await useCase.execute(counsel, 'doc-1');

    expect(result.data.id).toBe('doc-1');
    expect(result.data.fileName).toBe('contract.pdf');
    expect(result.data).not.toHaveProperty('deletedAt');
  });

  it('denies viewer access to unrelated document', async () => {
    await expect(useCase.execute(viewer, 'doc-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws 403 for unrelated counsel', async () => {
    await expect(useCase.execute(otherCounsel, 'doc-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws 404 when document does not exist', async () => {
    documentRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(counsel, 'missing')).rejects.toThrow(
      NotFoundException,
    );
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
  });

  it('throws 404 when all parent references are null', async () => {
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

  it('resolves parent owner from contract when legalCase is null', async () => {
    documentRepository.findById.mockResolvedValue({
      ...existingDocument,
      caseId: null,
      contractId: 'contract-1',
      legalCase: null,
      contract: { ownerId: counsel.id, deletedAt: null },
    });

    const result = await useCase.execute(counsel, 'doc-1');

    expect(result.data.contractId).toBe('contract-1');
  });

  it('resolves parent owner from notice when others are null', async () => {
    documentRepository.findById.mockResolvedValue({
      ...existingDocument,
      caseId: null,
      noticeId: 'notice-1',
      legalCase: null,
      contract: null,
      notice: { ownerId: counsel.id, deletedAt: null },
    });

    const result = await useCase.execute(counsel, 'doc-1');

    expect(result.data.noticeId).toBe('notice-1');
  });
});
