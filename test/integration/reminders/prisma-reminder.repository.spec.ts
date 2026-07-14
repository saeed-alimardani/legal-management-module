import {
  CaseStatus,
  CaseType,
  DeadlineStatus,
  Priority,
  ReminderStatus,
} from '@prisma/client';
import { ReminderView } from '../../../src/modules/reminders/domain/reminder-view.enum';
import { PrismaReminderRepository } from '../../../src/modules/reminders/infrastructure/prisma-reminder.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';
import {
  cleanupTestCases,
  cleanupTestDeadlines,
  cleanupTestReminders,
  disconnectTestPrisma,
  getUserIdByEmail,
  seedTestUsers,
} from '../../helpers/db.helper';

describe('PrismaReminderRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: PrismaReminderRepository;
  let ownerId: string;
  let assigneeId: string;
  let caseId: string;
  let deadlineId: string;

  const now = new Date('2026-07-14T12:00:00.000Z');

  beforeAll(async () => {
    await seedTestUsers();
    ownerId = await getUserIdByEmail('counsel@legal.local');
    assigneeId = await getUserIdByEmail('counsel2@legal.local');

    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaReminderRepository(prisma);
  });

  beforeEach(async () => {
    await cleanupTestReminders();
    await cleanupTestDeadlines();
    await cleanupTestCases();

    const legalCase = await prisma.legalCase.create({
      data: {
        referenceCode: `CASE-REM-${Date.now()}`,
        title: 'Reminder Parent Case',
        type: CaseType.LITIGATION,
        status: CaseStatus.OPEN,
        priority: Priority.HIGH,
        ownerId,
      },
    });
    caseId = legalCase.id;

    const deadline = await prisma.deadline.create({
      data: {
        title: 'Hearing date',
        dueDate: new Date('2026-07-20T00:00:00.000Z'),
        status: DeadlineStatus.PENDING,
        caseId,
        createdById: ownerId,
        assigneeId,
      },
    });
    deadlineId = deadline.id;

    await repository.create({
      deadlineId,
      remindAt: new Date('2026-07-10T08:00:00.000Z'),
      status: ReminderStatus.PENDING,
      message: 'Due reminder',
      createdById: ownerId,
    });
    await repository.create({
      deadlineId,
      remindAt: new Date('2026-07-18T08:00:00.000Z'),
      status: ReminderStatus.PENDING,
      message: 'Upcoming reminder',
      createdById: ownerId,
    });
    const sent = await repository.create({
      deadlineId,
      remindAt: new Date('2026-07-05T08:00:00.000Z'),
      status: ReminderStatus.PENDING,
      message: 'Already sent',
      createdById: ownerId,
    });
    await repository.markSent(sent.id, new Date('2026-07-05T09:00:00.000Z'));
  });

  afterAll(async () => {
    await cleanupTestReminders();
    await cleanupTestDeadlines();
    await cleanupTestCases();
    await prisma.$disconnect();
    await disconnectTestPrisma();
  });

  it('creates reminder linked to deadline', async () => {
    const created = await repository.create({
      deadlineId,
      remindAt: new Date('2026-07-19T08:00:00.000Z'),
      status: ReminderStatus.PENDING,
      message: 'New reminder',
      createdById: ownerId,
    });

    expect(created.deadlineId).toBe(deadlineId);
    expect(created.message).toBe('New reminder');
    expect(created.deadline.legalCase?.ownerId).toBe(ownerId);
    expect(created.status).toBe(ReminderStatus.PENDING);
  });

  it('finds reminder by id with deadline include', async () => {
    const created = await repository.create({
      deadlineId,
      remindAt: new Date('2026-07-21T08:00:00.000Z'),
      status: ReminderStatus.PENDING,
      createdById: ownerId,
    });

    const found = await repository.findById(created.id);

    expect(found?.id).toBe(created.id);
    expect(found?.deadline.assigneeId).toBe(assigneeId);
  });

  it('filters upcoming view to PENDING after now', async () => {
    const { items, total } = await repository.list(
      {
        view: ReminderView.UPCOMING,
        now,
        currentUserId: ownerId,
        page: 1,
        limit: 20,
      },
      {},
    );

    expect(total).toBe(1);
    expect(items[0].message).toBe('Upcoming reminder');
  });

  it('filters due view to PENDING at or before now', async () => {
    const { items, total } = await repository.list(
      {
        view: ReminderView.DUE,
        now,
        currentUserId: ownerId,
        page: 1,
        limit: 20,
      },
      {},
    );

    expect(total).toBe(1);
    expect(items[0].message).toBe('Due reminder');
  });

  it('finds due pending reminders ordered by remindAt asc', async () => {
    const due = await repository.findDuePending(now);

    expect(due.map((item) => item.message)).toEqual(['Due reminder']);
    expect(due.every((item) => item.status === ReminderStatus.PENDING)).toBe(
      true,
    );
  });

  it('marks reminder as sent', async () => {
    const pending = await repository.create({
      deadlineId,
      remindAt: new Date('2026-07-13T08:00:00.000Z'),
      status: ReminderStatus.PENDING,
      message: 'Mark sent target',
      createdById: ownerId,
    });

    const sentAt = new Date('2026-07-14T12:30:00.000Z');
    const sent = await repository.markSent(pending.id, sentAt);

    expect(sent.status).toBe(ReminderStatus.SENT);
    expect(sent.sentAt?.toISOString()).toBe(sentAt.toISOString());

    const due = await repository.findDuePending(now);
    expect(due.map((item) => item.id)).not.toContain(pending.id);
  });

  it('scopes counsel list to assignee or parent owner', async () => {
    const { total: assigneeTotal } = await repository.list(
      {
        now,
        currentUserId: assigneeId,
        page: 1,
        limit: 20,
      },
      { counselUserId: assigneeId },
    );

    // assignee sees reminders on deadlines where they are assignee
    expect(assigneeTotal).toBe(3);

    const otherDeadline = await prisma.deadline.create({
      data: {
        title: 'Other owner deadline',
        dueDate: new Date('2026-07-25T00:00:00.000Z'),
        status: DeadlineStatus.PENDING,
        caseId,
        createdById: ownerId,
      },
    });
    await repository.create({
      deadlineId: otherDeadline.id,
      remindAt: new Date('2026-07-24T08:00:00.000Z'),
      status: ReminderStatus.PENDING,
      createdById: ownerId,
    });

    const { total: ownerTotal } = await repository.list(
      {
        now,
        currentUserId: ownerId,
        page: 1,
        limit: 20,
      },
      { counselUserId: ownerId },
    );

    // owner sees all reminders on owned parent deadlines
    expect(ownerTotal).toBe(4);
  });
});
