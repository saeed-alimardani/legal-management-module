import {
  CaseType,
  CaseStatus,
  ContractStatus,
  ContractType,
  NoticeStatus,
  Priority,
  TaskStatus,
} from '@prisma/client';
import { PrismaTaskRepository } from '../../../src/modules/tasks/infrastructure/prisma-task.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';
import {
  cleanupTestCases,
  cleanupTestContracts,
  cleanupTestDocuments,
  cleanupTestNotices,
  cleanupTestTasks,
  deleteUserByEmail,
  disconnectTestPrisma,
  getUserIdByEmail,
  seedTestUsers,
  upsertInactiveUser,
} from '../../helpers/db.helper';

describe('PrismaTaskRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: PrismaTaskRepository;
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
    repository = new PrismaTaskRepository(prisma);
  });

  beforeEach(async () => {
    await cleanupTestTasks();
    await cleanupTestDocuments();
    await cleanupTestNotices();
    await cleanupTestContracts();
    await cleanupTestCases();

    const ts = Date.now();

    const legalCase = await prisma.legalCase.create({
      data: {
        referenceCode: `CASE-TASK-${ts}`,
        title: 'Task Parent Case',
        type: CaseType.LITIGATION,
        status: CaseStatus.OPEN,
        priority: Priority.HIGH,
        ownerId,
      },
    });
    caseId = legalCase.id;

    const contract = await prisma.contract.create({
      data: {
        referenceCode: `CTR-TASK-${ts}`,
        title: 'Task Parent Contract',
        type: ContractType.NDA,
        status: ContractStatus.ACTIVE,
        ownerId,
        counterpartyName: 'Acme',
      },
    });
    contractId = contract.id;

    const notice = await prisma.legalNotice.create({
      data: {
        referenceCode: `NOT-TASK-${ts}`,
        title: 'Task Parent Notice',
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
    await cleanupTestTasks();
    await cleanupTestDocuments();
    await cleanupTestNotices();
    await cleanupTestContracts();
    await cleanupTestCases();
    await prisma.$disconnect();
    await disconnectTestPrisma();
  });

  it('creates task with case parent and findById includes parent ownerId', async () => {
    const task = await repository.create({
      title: 'Case Task',
      status: TaskStatus.TODO,
      assigneeId: ownerId,
      createdById: ownerId,
      caseId,
    });

    const found = await repository.findById(task.id);

    expect(found).not.toBeNull();
    expect(found!.caseId).toBe(caseId);
    expect(found!.legalCase?.ownerId).toBe(ownerId);
    expect(found!.legalCase?.deletedAt).toBeNull();
  });

  it('creates task with contract parent and findById includes contract ownerId', async () => {
    const task = await repository.create({
      title: 'Contract Task',
      status: TaskStatus.TODO,
      assigneeId: ownerId,
      createdById: ownerId,
      contractId,
    });

    const found = await repository.findById(task.id);

    expect(found!.contractId).toBe(contractId);
    expect(found!.contract?.ownerId).toBe(ownerId);
  });

  it('creates task with notice parent and findById includes notice ownerId', async () => {
    const task = await repository.create({
      title: 'Notice Task',
      status: TaskStatus.TODO,
      assigneeId: ownerId,
      createdById: ownerId,
      noticeId,
    });

    const found = await repository.findById(task.id);

    expect(found!.noticeId).toBe(noticeId);
    expect(found!.notice?.ownerId).toBe(ownerId);
  });

  it('list filters by assigneeId', async () => {
    await repository.create({
      title: 'Assigned to owner',
      status: TaskStatus.TODO,
      assigneeId: ownerId,
      createdById: ownerId,
      caseId,
    });
    await repository.create({
      title: 'Assigned to counsel',
      status: TaskStatus.TODO,
      assigneeId: counselId,
      createdById: ownerId,
      caseId,
    });

    const { items, total } = await repository.list(
      { assigneeId: counselId, page: 1, limit: 20 },
      {},
    );

    expect(total).toBe(1);
    expect(items[0].title).toBe('Assigned to counsel');
  });

  it('list filters by status', async () => {
    await repository.create({
      title: 'Todo task',
      status: TaskStatus.TODO,
      assigneeId: ownerId,
      createdById: ownerId,
      caseId,
    });
    const inProg = await repository.create({
      title: 'In progress task',
      status: TaskStatus.IN_PROGRESS,
      assigneeId: ownerId,
      createdById: ownerId,
      caseId,
    });

    const { items, total } = await repository.list(
      { status: TaskStatus.IN_PROGRESS, page: 1, limit: 20 },
      {},
    );

    expect(total).toBe(1);
    expect(items[0].id).toBe(inProg.id);
  });

  it('list filters by caseId', async () => {
    await repository.create({
      title: 'Case task',
      status: TaskStatus.TODO,
      assigneeId: ownerId,
      createdById: ownerId,
      caseId,
    });
    await repository.create({
      title: 'Contract task',
      status: TaskStatus.TODO,
      assigneeId: ownerId,
      createdById: ownerId,
      contractId,
    });

    const { items, total } = await repository.list(
      { caseId, page: 1, limit: 20 },
      {},
    );

    expect(total).toBe(1);
    expect(items[0].caseId).toBe(caseId);
  });

  it('counsel scope sees tasks by assignee or createdBy', async () => {
    const assignedTask = await repository.create({
      title: 'Assigned to counsel',
      status: TaskStatus.TODO,
      assigneeId: counselId,
      createdById: ownerId,
      caseId,
    });
    const createdTask = await repository.create({
      title: 'Created by counsel',
      status: TaskStatus.TODO,
      assigneeId: ownerId,
      createdById: counselId,
      caseId,
    });

    const { items, total } = await repository.list(
      { page: 1, limit: 20 },
      { counselUserId: counselId },
    );

    expect(total).toBe(2);
    const ids = items.map((i) => i.id);
    expect(ids).toContain(assignedTask.id);
    expect(ids).toContain(createdTask.id);
  });

  it('counsel scope sees tasks on parent owned by counsel', async () => {
    const ts = Date.now();
    const counselCase = await prisma.legalCase.create({
      data: {
        referenceCode: `CASE-CS-${ts}`,
        title: 'Counsel Owned Case',
        type: CaseType.LITIGATION,
        status: CaseStatus.OPEN,
        priority: Priority.HIGH,
        ownerId: counselId,
      },
    });

    const task = await repository.create({
      title: 'Parent owner task',
      status: TaskStatus.TODO,
      assigneeId: ownerId,
      createdById: ownerId,
      caseId: counselCase.id,
    });

    const { items } = await repository.list(
      { page: 1, limit: 20 },
      { counselUserId: counselId },
    );

    expect(items.find((t) => t.id === task.id)).toBeDefined();
  });

  it('counsel scope does not see unrelated tasks', async () => {
    // ownerId creates and assigns to themselves on a case owned by ownerId
    await repository.create({
      title: 'Unrelated task',
      status: TaskStatus.TODO,
      assigneeId: ownerId,
      createdById: ownerId,
      caseId,
    });

    const { total } = await repository.list(
      { page: 1, limit: 20 },
      { counselUserId: counselId },
    );

    expect(total).toBe(0);
  });

  it('softDelete sets deletedAt; findById returns null; list excludes soft-deleted', async () => {
    const task = await repository.create({
      title: 'Delete me',
      status: TaskStatus.IN_PROGRESS,
      assigneeId: ownerId,
      createdById: ownerId,
      caseId,
    });
    await repository.update(task.id, {
      status: TaskStatus.DONE,
      completedAt: new Date(),
    });

    const deleted = await repository.softDelete(task.id);

    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.status).toBe(TaskStatus.DONE);
    expect(deleted.completedAt).not.toBeNull();
    expect(await repository.findById(task.id)).toBeNull();

    const { items } = await repository.list({ page: 1, limit: 20 }, {});
    expect(items.find((t) => t.id === task.id)).toBeUndefined();
  });

  it('update sets status DONE with completedAt', async () => {
    const task = await repository.create({
      title: 'Complete me',
      status: TaskStatus.IN_PROGRESS,
      assigneeId: ownerId,
      createdById: ownerId,
      caseId,
    });

    const updated = await repository.update(task.id, {
      status: TaskStatus.DONE,
      completedAt: new Date('2026-07-14T12:00:00.000Z'),
    });

    expect(updated.status).toBe(TaskStatus.DONE);
    expect(updated.completedAt).not.toBeNull();
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

  it('userExistsAndActive returns true for active user', async () => {
    expect(await repository.userExistsAndActive(ownerId)).toBe(true);
  });

  it('userExistsAndActive returns false for missing user', async () => {
    expect(
      await repository.userExistsAndActive(
        '00000000-0000-0000-0000-000000000000',
      ),
    ).toBe(false);
  });

  it('userExistsAndActive returns false for inactive user', async () => {
    const inactiveEmail = 'inactive-task-repo@legal.local';
    await upsertInactiveUser(inactiveEmail);
    const inactiveId = await getUserIdByEmail(inactiveEmail);

    expect(await repository.userExistsAndActive(inactiveId)).toBe(false);

    await deleteUserByEmail(inactiveEmail);
  });
});
