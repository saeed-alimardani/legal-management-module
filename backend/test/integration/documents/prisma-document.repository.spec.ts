import {
  CaseType,
  CaseStatus,
  ContractStatus,
  ContractType,
  DocumentType,
  NoticeStatus,
  Priority,
} from '@prisma/client';
import { PrismaDocumentRepository } from '../../../src/modules/documents/infrastructure/prisma-document.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';
import {
  cleanupTestCases,
  cleanupTestContracts,
  cleanupTestDocuments,
  cleanupTestNotices,
  cleanupTestTasks,
  disconnectTestPrisma,
  getUserIdByEmail,
  seedTestUsers,
} from '../../helpers/db.helper';

describe('PrismaDocumentRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: PrismaDocumentRepository;
  let ownerId: string;
  let counselId: string;
  let caseId: string;
  let contractId: string;
  let noticeId: string;

  beforeAll(async () => {
    await seedTestUsers();
    ownerId = await getUserIdByEmail('counsel@legal.local');
    counselId = await getUserIdByEmail('counsel2@legal.local');

    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaDocumentRepository(prisma);
  });

  beforeEach(async () => {
    await cleanupTestDocuments();
    await cleanupTestTasks();
    await cleanupTestNotices();
    await cleanupTestContracts();
    await cleanupTestCases();

    const ts = Date.now();

    const legalCase = await prisma.legalCase.create({
      data: {
        referenceCode: `CASE-DOC-${ts}`,
        title: 'Document Parent Case',
        type: CaseType.LITIGATION,
        status: CaseStatus.OPEN,
        priority: Priority.HIGH,
        ownerId,
      },
    });
    caseId = legalCase.id;

    const contract = await prisma.contract.create({
      data: {
        referenceCode: `CTR-DOC-${ts}`,
        title: 'Document Parent Contract',
        type: ContractType.MSA,
        status: ContractStatus.ACTIVE,
        ownerId,
        counterpartyName: 'Acme',
      },
    });
    contractId = contract.id;

    const notice = await prisma.legalNotice.create({
      data: {
        referenceCode: `NOT-DOC-${ts}`,
        title: 'Document Parent Notice',
        sender: 'Court',
        receivedDate: new Date('2026-01-01'),
        responseDeadline: new Date('2026-02-01'),
        status: NoticeStatus.RECEIVED,
        ownerId,
      },
    });
    noticeId = notice.id;
  });

  afterAll(async () => {
    await cleanupTestDocuments();
    await cleanupTestTasks();
    await cleanupTestNotices();
    await cleanupTestContracts();
    await cleanupTestCases();
    await prisma.$disconnect();
    await disconnectTestPrisma();
  });

  it('creates document and findById returns it with deletedAt null', async () => {
    const doc = await repository.create({
      fileName: 'evidence.pdf',
      mimeType: 'application/pdf',
      fileSize: 2048,
      storageKey: `sk-create-${Date.now()}`,
      documentType: DocumentType.EVIDENCE,
      uploadedById: ownerId,
      caseId,
    });

    const found = await repository.findById(doc.id);

    expect(found).not.toBeNull();
    expect(found!.deletedAt).toBeNull();
    expect(found!.caseId).toBe(caseId);
    expect(found!.legalCase?.ownerId).toBe(ownerId);
  });

  it('softDelete sets deletedAt; findById returns null; list excludes soft-deleted', async () => {
    const doc = await repository.create({
      fileName: 'to-delete.pdf',
      mimeType: 'application/pdf',
      fileSize: 512,
      storageKey: `sk-delete-${Date.now()}`,
      documentType: DocumentType.OTHER,
      uploadedById: ownerId,
      caseId,
    });

    await repository.softDelete(doc.id);

    expect(await repository.findById(doc.id)).toBeNull();

    const list = await repository.list({ caseId }, {});
    expect(list.find((d) => d.id === doc.id)).toBeUndefined();
  });

  it('list filters by caseId and excludes other parents', async () => {
    await repository.create({
      fileName: 'case-doc.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      storageKey: `sk-case-${Date.now()}`,
      documentType: DocumentType.FILING,
      uploadedById: ownerId,
      caseId,
    });
    await repository.create({
      fileName: 'contract-doc.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      storageKey: `sk-ctr-${Date.now()}`,
      documentType: DocumentType.CONTRACT,
      uploadedById: ownerId,
      contractId,
    });

    const results = await repository.list({ caseId }, {});

    expect(results).toHaveLength(1);
    expect(results[0].caseId).toBe(caseId);
  });

  it('list filters by contractId and excludes other parents', async () => {
    await repository.create({
      fileName: 'ctr-doc.pdf',
      mimeType: 'application/pdf',
      fileSize: 512,
      storageKey: `sk-ctr2-${Date.now()}`,
      documentType: DocumentType.CONTRACT,
      uploadedById: ownerId,
      contractId,
    });
    await repository.create({
      fileName: 'notice-doc.pdf',
      mimeType: 'application/pdf',
      fileSize: 512,
      storageKey: `sk-notice-${Date.now()}`,
      documentType: DocumentType.CORRESPONDENCE,
      uploadedById: ownerId,
      noticeId,
    });

    const results = await repository.list({ contractId }, {});

    expect(results).toHaveLength(1);
    expect(results[0].contractId).toBe(contractId);
  });

  it('list filters by noticeId and excludes other parents', async () => {
    await repository.create({
      fileName: 'notice-doc.pdf',
      mimeType: 'application/pdf',
      fileSize: 512,
      storageKey: `sk-not-${Date.now()}`,
      documentType: DocumentType.CORRESPONDENCE,
      uploadedById: ownerId,
      noticeId,
    });
    await repository.create({
      fileName: 'case-doc.pdf',
      mimeType: 'application/pdf',
      fileSize: 512,
      storageKey: `sk-case2-${Date.now()}`,
      documentType: DocumentType.FILING,
      uploadedById: ownerId,
      caseId,
    });

    const results = await repository.list({ noticeId }, {});

    expect(results).toHaveLength(1);
    expect(results[0].noticeId).toBe(noticeId);
  });

  it('counsel scope sees documents uploaded by self', async () => {
    const ownUploaded = await repository.create({
      fileName: 'own-upload.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      storageKey: `sk-counsel-upload-${Date.now()}`,
      documentType: DocumentType.OTHER,
      uploadedById: counselId,
      caseId,
    });
    // ownerId uploads doc on same case — counselId does NOT own parent
    await repository.create({
      fileName: 'unrelated.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      storageKey: `sk-unrelated-${Date.now()}`,
      documentType: DocumentType.OTHER,
      uploadedById: ownerId,
      caseId,
    });

    const results = await repository.list({}, { counselUserId: counselId });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(ownUploaded.id);
  });

  it('counsel scope sees documents on parent owned by counsel', async () => {
    const ts = Date.now();
    const counselCase = await prisma.legalCase.create({
      data: {
        referenceCode: `CASE-COUNSEL-${ts}`,
        title: 'Counsel Case',
        type: CaseType.LITIGATION,
        status: CaseStatus.OPEN,
        priority: Priority.MEDIUM,
        ownerId: counselId,
      },
    });

    const doc = await repository.create({
      fileName: 'counsel-case-doc.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      storageKey: `sk-cc-${ts}`,
      documentType: DocumentType.FILING,
      uploadedById: ownerId,
      caseId: counselCase.id,
    });

    const results = await repository.list({}, { counselUserId: counselId });

    expect(results.find((d) => d.id === doc.id)).toBeDefined();
  });

  it('counsel scope does not see documents uploaded by others on unowned parents', async () => {
    // ownerId uploads on ownerId-owned case
    await repository.create({
      fileName: 'not-mine.pdf',
      mimeType: 'application/pdf',
      fileSize: 512,
      storageKey: `sk-notmine-${Date.now()}`,
      documentType: DocumentType.OTHER,
      uploadedById: ownerId,
      caseId,
    });

    const results = await repository.list({}, { counselUserId: counselId });

    expect(results).toHaveLength(0);
  });

  it('findParentOwner returns ownerId for existing case', async () => {
    const owner = await repository.findParentOwner({ caseId });

    expect(owner).not.toBeNull();
    expect(owner!.ownerId).toBe(ownerId);
  });

  it('findParentOwner returns ownerId for existing contract', async () => {
    const owner = await repository.findParentOwner({ contractId });

    expect(owner).not.toBeNull();
    expect(owner!.ownerId).toBe(ownerId);
  });

  it('findParentOwner returns ownerId for existing notice', async () => {
    const owner = await repository.findParentOwner({ noticeId });

    expect(owner).not.toBeNull();
    expect(owner!.ownerId).toBe(ownerId);
  });

  it('findParentOwner returns null for soft-deleted case', async () => {
    await prisma.legalCase.update({
      where: { id: caseId },
      data: { deletedAt: new Date() },
    });

    const owner = await repository.findParentOwner({ caseId });

    expect(owner).toBeNull();
  });

  it('findParentOwner returns null for non-existent caseId', async () => {
    const owner = await repository.findParentOwner({
      caseId: '00000000-0000-0000-0000-000000000000',
    });

    expect(owner).toBeNull();
  });
});
