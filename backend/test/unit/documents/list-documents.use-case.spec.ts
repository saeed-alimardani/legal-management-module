import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentType, UserRole } from '@prisma/client';
import { ListDocumentsUseCase } from '../../../src/modules/documents/application/list-documents.use-case';
import { toDocumentResponse } from '../../../src/modules/documents/application/document.helpers';
import { DocumentWithParent } from '../../../src/modules/documents/domain/document.types';
import { PrismaDocumentRepository } from '../../../src/modules/documents/infrastructure/prisma-document.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('ListDocumentsUseCase', () => {
  let useCase: ListDocumentsUseCase;
  let documentRepository: jest.Mocked<Pick<PrismaDocumentRepository, 'list'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  const admin: AuthenticatedUser = {
    id: 'admin-id',
    email: 'admin@legal.local',
    fullName: 'Admin',
    role: UserRole.LEGAL_ADMIN,
  };

  const viewer: AuthenticatedUser = {
    id: 'viewer-id',
    email: 'viewer@legal.local',
    fullName: 'Viewer',
    role: UserRole.VIEWER,
  };

  const uploadedAt = new Date('2026-07-14T10:00:00.000Z');

  const docWithParent: DocumentWithParent = {
    id: 'doc-1',
    fileName: 'contract.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
    storageKey: 'uploads/uuid-1.pdf',
    documentType: DocumentType.CONTRACT,
    description: 'Signed agreement',
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
      list: jest.fn().mockResolvedValue([docWithParent]),
    };

    configService = {
      get: jest.fn().mockReturnValue('Asia/Tehran'),
    };

    useCase = new ListDocumentsUseCase(
      documentRepository as unknown as PrismaDocumentRepository,
      new AccessControlService(),
      configService as unknown as ConfigService,
    );
  });

  it('throws 400 when no parent FK provided', async () => {
    await expect(useCase.execute(counsel, {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws 400 when multiple parent FKs provided', async () => {
    await expect(
      useCase.execute(counsel, { caseId: 'case-1', contractId: 'contract-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('maps results to DocumentResponse (omits deletedAt)', async () => {
    const result = await useCase.execute(counsel, { caseId: 'case-1' });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('doc-1');
    expect(result.data[0]).not.toHaveProperty('deletedAt');
  });

  it('passes caseId filter to repository', async () => {
    await useCase.execute(counsel, { caseId: 'case-1' });

    expect(documentRepository.list).toHaveBeenCalledWith(
      { caseId: 'case-1', contractId: undefined, noticeId: undefined },
      expect.any(Object),
    );
  });

  it('passes contractId filter to repository', async () => {
    await useCase.execute(counsel, { contractId: 'contract-1' });

    expect(documentRepository.list).toHaveBeenCalledWith(
      { caseId: undefined, contractId: 'contract-1', noticeId: undefined },
      expect.any(Object),
    );
  });

  it('passes noticeId filter to repository', async () => {
    await useCase.execute(counsel, { noticeId: 'notice-1' });

    expect(documentRepository.list).toHaveBeenCalledWith(
      { caseId: undefined, contractId: undefined, noticeId: 'notice-1' },
      expect.any(Object),
    );
  });

  it('scopes counsel list with counselUserId filter', async () => {
    await useCase.execute(counsel, { caseId: 'case-1' });

    expect(documentRepository.list).toHaveBeenCalledWith(expect.any(Object), {
      counselUserId: counsel.id,
    });
  });

  it('admin receives empty scope object', async () => {
    await useCase.execute(admin, { caseId: 'case-1' });

    expect(documentRepository.list).toHaveBeenCalledWith(
      expect.any(Object),
      {},
    );
  });

  it('viewer receives empty scope object', async () => {
    await useCase.execute(viewer, { caseId: 'case-1' });

    expect(documentRepository.list).toHaveBeenCalledWith(
      expect.any(Object),
      {},
    );
  });

  it('returns empty array when repository returns no items', async () => {
    documentRepository.list.mockResolvedValue([]);

    const result = await useCase.execute(counsel, { caseId: 'case-1' });

    expect(result.data).toEqual([]);
  });

  it('maps all fields correctly in toDocumentResponse', async () => {
    const result = await useCase.execute(counsel, { caseId: 'case-1' });

    expect(result.data[0]).toEqual(
      toDocumentResponse(docWithParent, 'Asia/Tehran'),
    );
  });
});
