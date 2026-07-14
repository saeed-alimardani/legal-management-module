import { ConfigService } from '@nestjs/config';
import {
  CaseStatus,
  CaseType,
  DeadlineStatus,
  NoticeStatus,
  Priority,
  UserRole,
} from '@prisma/client';
import { CreateNoticeUseCase } from '../../../src/modules/notices/application/create-notice.use-case';
import { PrismaNoticeRepository } from '../../../src/modules/notices/infrastructure/prisma-notice.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import {
  cleanupTestCases,
  cleanupTestContracts,
  cleanupTestNotices,
  disconnectTestPrisma,
  getTestPrisma,
  getUserIdByEmail,
  seedTestUsers,
} from '../../helpers/db.helper';

describe('PrismaNoticeRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: PrismaNoticeRepository;
  let ownerId: string;
  let secondOwnerId: string;

  beforeAll(async () => {
    await seedTestUsers();
    ownerId = await getUserIdByEmail('counsel@legal.local');
    secondOwnerId = await getUserIdByEmail('counsel2@legal.local');

    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaNoticeRepository(prisma);
  });

  beforeEach(async () => {
    await cleanupTestNotices();
    await cleanupTestCases();
    await cleanupTestContracts();
  });

  afterAll(async () => {
    await cleanupTestNotices();
    await cleanupTestCases();
    await cleanupTestContracts();
    await prisma.$disconnect();
    await disconnectTestPrisma();
  });

  it('generates sequential NTC reference codes for the current year', async () => {
    const first = await repository.generateNextReferenceCode();
    const year = new Date().getFullYear();

    expect(first).toBe(`NTC-${year}-00001`);

    await repository.create({
      referenceCode: first,
      title: 'First Notice',
      sender: 'Sender A',
      receivedDate: new Date('2026-07-01T00:00:00.000Z'),
      responseDeadline: new Date('2026-07-10T00:00:00.000Z'),
      status: NoticeStatus.RECEIVED,
      ownerId,
    });

    const second = await repository.generateNextReferenceCode();
    expect(second).toBe(`NTC-${year}-00002`);
  });

  it('creates notice and finds related case/contract existence', async () => {
    const client = getTestPrisma();

    const legalCase = await client.legalCase.create({
      data: {
        referenceCode: `CASE-${new Date().getFullYear()}-90001`,
        title: 'Related Case',
        type: CaseType.LITIGATION,
        status: CaseStatus.OPEN,
        priority: Priority.HIGH,
        ownerId,
      },
    });

    const contract = await client.contract.create({
      data: {
        referenceCode: `CTR-${new Date().getFullYear()}-90001`,
        title: 'Related Contract',
        type: 'MSA',
        status: 'ACTIVE',
        ownerId,
        counterpartyName: 'Acme',
      },
    });

    expect(await repository.relatedCaseExists(legalCase.id)).toBe(true);
    expect(await repository.relatedContractExists(contract.id)).toBe(true);
    expect(
      await repository.relatedCaseExists(
        '00000000-0000-0000-0000-000000000000',
      ),
    ).toBe(false);

    const referenceCode = await repository.generateNextReferenceCode();
    const created = await repository.create({
      referenceCode,
      title: 'Linked Notice',
      sender: 'Vendor X',
      receivedDate: new Date('2026-07-01T00:00:00.000Z'),
      responseDeadline: new Date('2026-07-15T00:00:00.000Z'),
      status: NoticeStatus.UNDER_REVIEW,
      ownerId,
      relatedCaseId: legalCase.id,
      relatedContractId: contract.id,
      description: 'Linked',
    });

    expect(created.relatedCaseId).toBe(legalCase.id);
    expect(created.relatedContractId).toBe(contract.id);
  });

  it('lists only non-deleted notices and applies owner scope', async () => {
    const ref1 = await repository.generateNextReferenceCode();
    const owned = await repository.create({
      referenceCode: ref1,
      title: 'Owned',
      sender: 'A',
      receivedDate: new Date('2026-07-01T00:00:00.000Z'),
      responseDeadline: new Date('2026-07-10T00:00:00.000Z'),
      status: NoticeStatus.RECEIVED,
      ownerId,
    });

    const ref2 = await repository.generateNextReferenceCode();
    await repository.create({
      referenceCode: ref2,
      title: 'Other',
      sender: 'B',
      receivedDate: new Date('2026-07-01T00:00:00.000Z'),
      responseDeadline: new Date('2026-07-10T00:00:00.000Z'),
      status: NoticeStatus.RECEIVED,
      ownerId: secondOwnerId,
    });

    const scoped = await repository.list({ page: 1, limit: 20 }, { ownerId });
    expect(scoped.total).toBe(1);
    expect(scoped.items[0].id).toBe(owned.id);

    const all = await repository.list({ page: 1, limit: 20 }, {});
    expect(all.total).toBe(2);
  });

  it('excludes soft-deleted notices from findById and list', async () => {
    const referenceCode = await repository.generateNextReferenceCode();
    const created = await repository.create({
      referenceCode,
      title: 'Delete Me',
      sender: 'X',
      receivedDate: new Date('2026-07-01T00:00:00.000Z'),
      responseDeadline: new Date('2026-07-10T00:00:00.000Z'),
      status: NoticeStatus.CLOSED,
      ownerId,
    });

    await repository.softDelete(created.id);

    expect(await repository.findById(created.id)).toBeNull();
    expect((await repository.list({ page: 1, limit: 20 }, {})).total).toBe(0);
  });

  it('filters by status and reassigns owner', async () => {
    const ref1 = await repository.generateNextReferenceCode();
    await repository.create({
      referenceCode: ref1,
      title: 'Overdue',
      sender: 'X',
      receivedDate: new Date('2026-06-01T00:00:00.000Z'),
      responseDeadline: new Date('2026-06-10T00:00:00.000Z'),
      status: NoticeStatus.OVERDUE,
      ownerId,
    });

    const ref2 = await repository.generateNextReferenceCode();
    const received = await repository.create({
      referenceCode: ref2,
      title: 'Received',
      sender: 'Y',
      receivedDate: new Date('2026-07-01T00:00:00.000Z'),
      responseDeadline: new Date('2026-07-10T00:00:00.000Z'),
      status: NoticeStatus.RECEIVED,
      ownerId,
    });

    const filtered = await repository.list(
      { page: 1, limit: 20, status: NoticeStatus.OVERDUE },
      {},
    );
    expect(filtered.total).toBe(1);
    expect(filtered.items[0].title).toBe('Overdue');

    const reassigned = await repository.reassign(received.id, secondOwnerId);
    expect(reassigned.ownerId).toBe(secondOwnerId);
  });

  it('updates notice fields', async () => {
    const referenceCode = await repository.generateNextReferenceCode();
    const created = await repository.create({
      referenceCode,
      title: 'Original',
      sender: 'Sender',
      receivedDate: new Date('2026-07-01T00:00:00.000Z'),
      responseDeadline: new Date('2026-07-10T00:00:00.000Z'),
      status: NoticeStatus.RECEIVED,
      ownerId,
    });

    const updated = await repository.update(created.id, {
      title: 'Updated',
      status: NoticeStatus.RESPONDED,
      description: 'Done',
    });

    expect(updated.title).toBe('Updated');
    expect(updated.status).toBe(NoticeStatus.RESPONDED);
    expect(updated.description).toBe('Done');
  });
});

describe('CreateNoticeUseCase auto-deadline (integration)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    await seedTestUsers();
    prisma = new PrismaService();
    await prisma.$connect();
  });

  beforeEach(async () => {
    await cleanupTestNotices();
  });

  afterAll(async () => {
    await cleanupTestNotices();
    await prisma.$disconnect();
    await disconnectTestPrisma();
  });

  it('persists notice and linked deadline with matching dueDate atomically', async () => {
    const ownerId = await getUserIdByEmail('counsel@legal.local');
    const noticeRepository = new PrismaNoticeRepository(prisma);
    const activityLogService = new ActivityLogService(
      prisma,
      new AccessControlService(),
    );
    const configService = {
      get: jest.fn().mockReturnValue('Asia/Tehran'),
    } as unknown as ConfigService;
    const useCase = new CreateNoticeUseCase(
      noticeRepository,
      prisma,
      new AccessControlService(),
      activityLogService,
      configService,
    );

    const responseDeadline = new Date('2026-07-20T00:00:00.000Z');

    const result = await useCase.execute(
      {
        id: ownerId,
        email: 'counsel@legal.local',
        fullName: 'Legal Counsel',
        role: UserRole.LEGAL_COUNSEL,
      },
      {
        title: 'Integration Notice',
        sender: 'Regulator',
        receivedDate: new Date('2026-07-10T00:00:00.000Z'),
        responseDeadline,
      },
    );

    expect(result.data.referenceCode).toMatch(/^NTC-\d{4}-\d{5}$/);
    expect(result.data.responseDeadlinePersian).toMatch(
      /^\d{4}\/\d{2}\/\d{2}$/,
    );

    const deadlines = await prisma.deadline.findMany({
      where: { noticeId: result.data.id },
    });

    expect(deadlines).toHaveLength(1);
    expect(deadlines[0].dueDate.toISOString().slice(0, 10)).toBe('2026-07-20');
    expect(deadlines[0].status).toBe(DeadlineStatus.PENDING);
    expect(deadlines[0].title).toBe('Response deadline: Integration Notice');
    expect(deadlines[0].assigneeId).toBe(ownerId);
    expect(deadlines[0].createdById).toBe(ownerId);

    const noticeLogs = await prisma.activityLog.findMany({
      where: {
        entityType: 'NOTICE',
        entityId: result.data.id,
      },
    });
    const deadlineLogs = await prisma.activityLog.findMany({
      where: {
        entityType: 'DEADLINE',
        entityId: deadlines[0].id,
      },
    });

    expect(noticeLogs).toHaveLength(1);
    expect(deadlineLogs).toHaveLength(1);
    expect(deadlineLogs[0].metadata).toEqual(
      expect.objectContaining({ autoCreated: true }),
    );
  });
});
