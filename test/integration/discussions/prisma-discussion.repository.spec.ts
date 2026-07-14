import {
  CaseStatus,
  CaseType,
  ContractStatus,
  ContractType,
  NoticeStatus,
  Priority,
} from '@prisma/client';
import { PrismaDiscussionRepository } from '../../../src/modules/discussions/infrastructure/prisma-discussion.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';
import {
  cleanupTestCases,
  cleanupTestContracts,
  cleanupTestDiscussions,
  cleanupTestNotices,
  disconnectTestPrisma,
  getUserIdByEmail,
  seedTestUsers,
} from '../../helpers/db.helper';

describe('PrismaDiscussionRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: PrismaDiscussionRepository;
  let ownerId: string;
  let secondOwnerId: string;
  let caseId: string;
  let otherCaseId: string;
  let contractId: string;
  let noticeId: string;

  beforeAll(async () => {
    await seedTestUsers();
    ownerId = await getUserIdByEmail('counsel@legal.local');
    secondOwnerId = await getUserIdByEmail('counsel2@legal.local');

    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaDiscussionRepository(prisma);
  });

  beforeEach(async () => {
    await cleanupTestDiscussions();
    await cleanupTestNotices();
    await cleanupTestContracts();
    await cleanupTestCases();

    const ts = Date.now();

    const ownedCase = await prisma.legalCase.create({
      data: {
        referenceCode: `CASE-DISC-${ts}`,
        title: 'Discussion Parent Case',
        type: CaseType.LITIGATION,
        status: CaseStatus.OPEN,
        priority: Priority.HIGH,
        ownerId,
      },
    });
    caseId = ownedCase.id;

    const otherCase = await prisma.legalCase.create({
      data: {
        referenceCode: `CASE-DISC-OTHER-${ts}`,
        title: 'Other Counsel Case',
        type: CaseType.INTERNAL,
        status: CaseStatus.OPEN,
        priority: Priority.LOW,
        ownerId: secondOwnerId,
      },
    });
    otherCaseId = otherCase.id;

    const contract = await prisma.contract.create({
      data: {
        referenceCode: `CTR-DISC-${ts}`,
        title: 'Discussion Parent Contract',
        type: ContractType.NDA,
        status: ContractStatus.ACTIVE,
        ownerId,
        counterpartyName: 'Acme',
      },
    });
    contractId = contract.id;

    const notice = await prisma.legalNotice.create({
      data: {
        referenceCode: `NOT-DISC-${ts}`,
        title: 'Discussion Parent Notice',
        sender: 'Regulator',
        receivedDate: new Date('2026-01-01'),
        responseDeadline: new Date('2026-02-01'),
        status: NoticeStatus.RECEIVED,
        ownerId,
      },
    });
    noticeId = notice.id;
  });

  afterAll(async () => {
    await cleanupTestDiscussions();
    await cleanupTestNotices();
    await cleanupTestContracts();
    await cleanupTestCases();
    await prisma.$disconnect();
    await disconnectTestPrisma();
  });

  it('creates discussion on case with parent include', async () => {
    const created = await repository.create({
      content: 'Initial case note',
      authorId: ownerId,
      caseId,
    });

    expect(created.content).toBe('Initial case note');
    expect(created.caseId).toBe(caseId);
    expect(created.legalCase?.ownerId).toBe(ownerId);
    expect(created.deletedAt).toBeNull();
  });

  it('finds discussion by id', async () => {
    const created = await repository.create({
      content: 'Find me',
      authorId: ownerId,
      contractId,
    });

    const found = await repository.findById(created.id);

    expect(found?.id).toBe(created.id);
    expect(found?.contract?.ownerId).toBe(ownerId);
  });

  it('excludes soft-deleted discussions from findById and list', async () => {
    const created = await repository.create({
      content: 'Delete me',
      authorId: ownerId,
      noticeId,
    });

    await repository.softDelete(created.id);

    expect(await repository.findById(created.id)).toBeNull();

    const list = await repository.list({ page: 1, limit: 20 }, {});
    expect(list.total).toBe(0);
  });

  it('lists discussions filtered by parent id', async () => {
    await repository.create({
      content: 'On case',
      authorId: ownerId,
      caseId,
    });
    await repository.create({
      content: 'On contract',
      authorId: ownerId,
      contractId,
    });

    const caseList = await repository.list(
      { caseId, page: 1, limit: 20 },
      {},
    );
    expect(caseList.total).toBe(1);
    expect(caseList.items[0].content).toBe('On case');
  });

  it('scopes counsel list to owned parent entities', async () => {
    await repository.create({
      content: 'Owned case discussion',
      authorId: ownerId,
      caseId,
    });
    await repository.create({
      content: 'Other counsel case discussion',
      authorId: secondOwnerId,
      caseId: otherCaseId,
    });

    const scoped = await repository.list(
      { page: 1, limit: 20 },
      { counselUserId: ownerId },
    );

    expect(scoped.total).toBe(1);
    expect(scoped.items[0].content).toBe('Owned case discussion');

    const all = await repository.list({ page: 1, limit: 20 }, {});
    expect(all.total).toBe(2);
  });

  it('updates discussion content', async () => {
    const created = await repository.create({
      content: 'Original',
      authorId: ownerId,
      caseId,
    });

    const updated = await repository.update(created.id, {
      content: 'Revised',
    });

    expect(updated.content).toBe('Revised');
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      created.updatedAt.getTime(),
    );
  });

  it('soft-deletes discussion', async () => {
    const created = await repository.create({
      content: 'Soft delete target',
      authorId: ownerId,
      caseId,
    });

    const deleted = await repository.softDelete(created.id);

    expect(deleted.deletedAt).not.toBeNull();
  });

  it('finds parent owner for case, contract, and notice', async () => {
    expect(await repository.findParentOwner({ caseId })).toEqual({
      ownerId,
    });
    expect(await repository.findParentOwner({ contractId })).toEqual({
      ownerId,
    });
    expect(await repository.findParentOwner({ noticeId })).toEqual({
      ownerId,
    });
    expect(await repository.findParentOwner({})).toBeNull();
  });

});
