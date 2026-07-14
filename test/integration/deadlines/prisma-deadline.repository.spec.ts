import { DeadlineStatus } from '@prisma/client';
import { PrismaDeadlineRepository } from '../../../src/modules/deadlines/infrastructure/prisma-deadline.repository';
import { DeadlineView } from '../../../src/modules/deadlines/domain/deadline-view.enum';
import { PrismaService } from '../../../src/prisma/prisma.service';
import {
  cleanupTestCases,
  cleanupTestDeadlines,
  disconnectTestPrisma,
  getTestPrisma,
  getUserIdByEmail,
  seedTestUsers,
} from '../../helpers/db.helper';

describe('PrismaDeadlineRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: PrismaDeadlineRepository;
  let ownerId: string;
  let assigneeId: string;
  let caseId: string;

  const today = new Date('2026-07-14T00:00:00.000Z');

  beforeAll(async () => {
    await seedTestUsers();
    ownerId = await getUserIdByEmail('counsel@legal.local');
    assigneeId = await getUserIdByEmail('counsel2@legal.local');

    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaDeadlineRepository(prisma);
  });

  beforeEach(async () => {
    await cleanupTestDeadlines();
    await cleanupTestCases();

    const legalCase = await prisma.legalCase.create({
      data: {
        referenceCode: `CASE-TEST-${Date.now()}`,
        title: 'Deadline Parent Case',
        type: 'LITIGATION',
        status: 'OPEN',
        priority: 'HIGH',
        ownerId,
      },
    });
    caseId = legalCase.id;

    await repository.create({
      title: 'Overdue',
      dueDate: new Date('2026-07-10T00:00:00.000Z'),
      status: DeadlineStatus.PENDING,
      caseId,
      createdById: ownerId,
      assigneeId,
    });
    await repository.create({
      title: 'Today',
      dueDate: today,
      status: DeadlineStatus.PENDING,
      caseId,
      createdById: ownerId,
      assigneeId: ownerId,
    });
    await repository.create({
      title: 'Upcoming',
      dueDate: new Date('2026-07-20T00:00:00.000Z'),
      status: DeadlineStatus.PENDING,
      caseId,
      createdById: ownerId,
    });
    const completed = await repository.create({
      title: 'Completed ignored',
      dueDate: new Date('2026-07-10T00:00:00.000Z'),
      status: DeadlineStatus.PENDING,
      caseId,
      createdById: ownerId,
    });
    await repository.update(completed.id, {
      status: DeadlineStatus.COMPLETED,
      completedAt: new Date(),
    });
  });

  afterAll(async () => {
    await cleanupTestDeadlines();
    await cleanupTestCases();
    await prisma.$disconnect();
    await disconnectTestPrisma();
  });

  it('filters overdue view to PENDING before today', async () => {
    const { items, total } = await repository.list(
      {
        view: DeadlineView.OVERDUE,
        today,
        currentUserId: ownerId,
        page: 1,
        limit: 20,
      },
      {},
    );

    expect(total).toBe(1);
    expect(items[0].title).toBe('Overdue');
  });

  it('filters today view', async () => {
    const { items } = await repository.list(
      {
        view: DeadlineView.TODAY,
        today,
        currentUserId: ownerId,
        page: 1,
        limit: 20,
      },
      {},
    );

    expect(items.map((item) => item.title)).toEqual(['Today']);
  });

  it('filters upcoming view ordered by dueDate ASC', async () => {
    const { items } = await repository.list(
      {
        view: DeadlineView.UPCOMING,
        today,
        currentUserId: ownerId,
        page: 1,
        limit: 20,
      },
      {},
    );

    expect(items.map((item) => item.title)).toEqual(['Upcoming']);
  });

  it('filters assigned-to-me for current user', async () => {
    const { items } = await repository.list(
      {
        view: DeadlineView.ASSIGNED_TO_ME,
        today,
        currentUserId: assigneeId,
        page: 1,
        limit: 20,
      },
      {},
    );

    expect(items.every((item) => item.assigneeId === assigneeId)).toBe(true);
    expect(items.map((item) => item.title)).toContain('Overdue');
    expect(items.map((item) => item.title)).not.toContain('Today');
  });

  it('scopes counsel list to owned parent or assignee', async () => {
    const { total } = await repository.list(
      {
        today,
        currentUserId: assigneeId,
        page: 1,
        limit: 20,
      },
      { counselUserId: assigneeId },
    );

    // assignee sees only rows where they are assignee (not parent owner)
    expect(total).toBe(1);
  });

  it('rejects create with zero parents via DB check when both null', async () => {
    await expect(
      repository.create({
        title: 'Invalid',
        dueDate: today,
        status: DeadlineStatus.PENDING,
        createdById: ownerId,
      }),
    ).rejects.toThrow();
  });
});
