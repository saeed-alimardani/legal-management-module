import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  AuditAction,
  CaseStatus,
  CaseType,
  EntityType,
  Priority,
  ReminderStatus,
} from '@prisma/client';
import { ReminderView } from '../../src/modules/reminders/domain/reminder-view.enum';
import { authHeader, loginAs } from '../helpers/auth.helper';
import { createTestApp } from '../helpers/app.helper';
import {
  cleanupTestCases,
  cleanupTestContracts,
  cleanupTestDeadlines,
  cleanupTestNotices,
  cleanupTestReminders,
  disconnectTestPrisma,
  getTestPrisma,
  getUserIdByEmail,
  seedTestUsers,
} from '../helpers/db.helper';

describe('Reminders (e2e)', () => {
  let app: INestApplication;
  let counselToken: string;
  let counsel2Token: string;
  let managerToken: string;
  let adminToken: string;
  let viewerToken: string;
  let counselId: string;
  let counsel2Id: string;

  async function refreshAuthContext(): Promise<void> {
    await seedTestUsers();
    counselId = await getUserIdByEmail('counsel@legal.local');
    counsel2Id = await getUserIdByEmail('counsel2@legal.local');
    counselToken = (await loginAs(app, 'counsel@legal.local')).token;
    counsel2Token = (await loginAs(app, 'counsel2@legal.local')).token;
    managerToken = (await loginAs(app, 'manager@legal.local')).token;
    adminToken = (await loginAs(app, 'admin@legal.local')).token;
    viewerToken = (await loginAs(app, 'viewer@legal.local')).token;
  }

  beforeAll(async () => {
    await seedTestUsers();
    app = await createTestApp();
    await refreshAuthContext();
  });

  beforeEach(async () => {
    await cleanupTestReminders();
    await cleanupTestDeadlines();
    await cleanupTestNotices();
    await cleanupTestCases();
    await cleanupTestContracts();
    await refreshAuthContext();
  });

  afterAll(async () => {
    await cleanupTestReminders();
    await cleanupTestDeadlines();
    await cleanupTestNotices();
    await cleanupTestCases();
    await cleanupTestContracts();
    await app.close();
    await disconnectTestPrisma();
  });

  async function createCaseViaApi(token: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/cases')
      .set(authHeader(token))
      .send({
        title: 'Reminder Parent Case',
        type: CaseType.LITIGATION,
        status: CaseStatus.OPEN,
        priority: Priority.MEDIUM,
      })
      .expect(201);
    return res.body.data;
  }

  async function createDeadlineViaApi(
    token: string,
    overrides: Record<string, unknown> = {},
  ) {
    const legalCase = await createCaseViaApi(token);
    const res = await request(app.getHttpServer())
      .post('/api/v1/deadlines')
      .set(authHeader(token))
      .send({
        title: 'Reminder Parent Deadline',
        dueDate: '2026-08-01',
        assigneeId: counselId,
        caseId: legalCase.id,
        ...overrides,
      })
      .expect(201);
    return { deadline: res.body.data, legalCase };
  }

  async function createReminderViaApi(
    token: string,
    deadlineId: string,
    overrides: Record<string, unknown> = {},
  ) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/reminders')
      .set(authHeader(token))
      .send({
        deadlineId,
        remindAt: '2026-07-20T09:00:00.000Z',
        message: 'E2E reminder message',
        ...overrides,
      })
      .expect(201);
    return res.body.data;
  }

  describe('Auth and RBAC', () => {
    it('returns 401 for unauthenticated list request', async () => {
      await request(app.getHttpServer()).get('/api/v1/reminders').expect(401);
    });

    it('returns 403 when viewer tries to create a reminder', async () => {
      const { deadline } = await createDeadlineViaApi(counselToken);
      await request(app.getHttpServer())
        .post('/api/v1/reminders')
        .set(authHeader(viewerToken))
        .send({
          deadlineId: deadline.id,
          remindAt: '2026-07-20T09:00:00.000Z',
        })
        .expect(403);
    });

    it('allows counsel to create a reminder on own deadline', async () => {
      const { deadline } = await createDeadlineViaApi(counselToken);
      const created = await createReminderViaApi(counselToken, deadline.id, {
        message: 'Prepare documents',
      });

      expect(created.deadlineId).toBe(deadline.id);
      expect(created.status).toBe(ReminderStatus.PENDING);
      expect(created.message).toBe('Prepare documents');
    });

    it('returns 403 when counsel tries process-due', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reminders/process-due')
        .set(authHeader(counselToken))
        .expect(403);
    });

    it('allows manager to process due reminders', async () => {
      const { deadline } = await createDeadlineViaApi(counselToken);
      const reminder = await createReminderViaApi(counselToken, deadline.id, {
        remindAt: '2020-01-01T09:00:00.000Z',
      });

      const processed = await request(app.getHttpServer())
        .post('/api/v1/reminders/process-due')
        .set(authHeader(managerToken))
        .expect(200);

      expect(processed.body.data.processedCount).toBeGreaterThanOrEqual(1);
      expect(processed.body.data.reminders.some(
        (r: { id: string }) => r.id === reminder.id,
      )).toBe(true);

      const dbReminder = await getTestPrisma().reminder.findUnique({
        where: { id: reminder.id },
      });
      expect(dbReminder?.status).toBe(ReminderStatus.SENT);
      expect(dbReminder?.sentAt).not.toBeNull();
    });
  });

  describe('Validation', () => {
    it('returns 400 when deadlineId is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reminders')
        .set(authHeader(counselToken))
        .send({ remindAt: '2026-07-20T09:00:00.000Z' })
        .expect(400);
    });

    it('returns 404 for missing deadline', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reminders')
        .set(authHeader(counselToken))
        .send({
          deadlineId: '11111111-1111-4111-8111-111111111111',
          remindAt: '2026-07-20T09:00:00.000Z',
        })
        .expect(404);
    });

    it('returns 400 for invalid UUID in GET path', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/reminders/not-a-uuid')
        .set(authHeader(counselToken))
        .expect(400);
    });
  });

  describe('List views', () => {
    beforeEach(async () => {
      const prisma = getTestPrisma();
      const legalCase = await prisma.legalCase.create({
        data: {
          referenceCode: `CASE-RM-${Date.now()}`,
          title: 'Reminder View Case',
          type: CaseType.LITIGATION,
          status: CaseStatus.OPEN,
          priority: Priority.HIGH,
          ownerId: counselId,
        },
      });

      const deadline = await prisma.deadline.create({
        data: {
          title: 'Reminder View Deadline',
          dueDate: new Date('2026-08-01T00:00:00.000Z'),
          status: 'PENDING',
          caseId: legalCase.id,
          assigneeId: counselId,
          createdById: counselId,
        },
      });

      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      await prisma.reminder.createMany({
        data: [
          {
            deadlineId: deadline.id,
            remindAt: new Date(future),
            status: ReminderStatus.PENDING,
            message: 'Upcoming reminder',
            createdById: counselId,
          },
          {
            deadlineId: deadline.id,
            remindAt: new Date(past),
            status: ReminderStatus.PENDING,
            message: 'Due reminder',
            createdById: counselId,
          },
          {
            deadlineId: deadline.id,
            remindAt: new Date(past),
            status: ReminderStatus.SENT,
            sentAt: new Date(),
            message: 'Sent reminder',
            createdById: counselId,
          },
          {
            deadlineId: deadline.id,
            remindAt: new Date(future),
            status: ReminderStatus.PENDING,
            message: 'Assigned to counsel2',
            createdById: counselId,
          },
        ],
      });

      await prisma.deadline.update({
        where: { id: deadline.id },
        data: { assigneeId: counsel2Id },
      });
    });

    it('filters upcoming view', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reminders')
        .query({ view: ReminderView.UPCOMING })
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(
        res.body.data.every(
          (r: { status: string }) => r.status === ReminderStatus.PENDING,
        ),
      ).toBe(true);
    });

    it('filters due view', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reminders')
        .query({ view: ReminderView.DUE })
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data.some(
        (r: { message: string }) => r.message === 'Due reminder',
      )).toBe(true);
    });

    it('filters sent view', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reminders')
        .query({ view: ReminderView.SENT })
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data.some(
        (r: { message: string }) => r.message === 'Sent reminder',
      )).toBe(true);
    });

    it('filters assigned-to-me view', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reminders')
        .query({ view: ReminderView.ASSIGNED_TO_ME })
        .set(authHeader(counsel2Token))
        .expect(200);

      expect(res.body.data).toHaveLength(4);
      expect(res.body.meta.total).toBe(4);
    });
  });

  describe('Reminder lifecycle', () => {
    it('create → get → patch message → dismiss → activity logs', async () => {
      const { deadline } = await createDeadlineViaApi(counselToken);
      const created = await createReminderViaApi(counselToken, deadline.id);

      const fetched = await request(app.getHttpServer())
        .get(`/api/v1/reminders/${created.id}`)
        .set(authHeader(counselToken))
        .expect(200);
      expect(fetched.body.data.id).toBe(created.id);

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/reminders/${created.id}`)
        .set(authHeader(counselToken))
        .send({ message: 'Updated reminder text' })
        .expect(200);
      expect(updated.body.data.message).toBe('Updated reminder text');

      const dismissed = await request(app.getHttpServer())
        .patch(`/api/v1/reminders/${created.id}`)
        .set(authHeader(counselToken))
        .send({ status: ReminderStatus.DISMISSED })
        .expect(200);
      expect(dismissed.body.data.status).toBe(ReminderStatus.DISMISSED);

      const logs = await getTestPrisma().activityLog.findMany({
        where: { entityType: EntityType.REMINDER, entityId: created.id },
        orderBy: { createdAt: 'asc' },
      });

      expect(logs.map((log) => log.action)).toContain(AuditAction.CREATED);
    });

    it('process-due writes REMINDER_SENT activity logs', async () => {
      const { deadline } = await createDeadlineViaApi(counselToken);
      const reminder = await createReminderViaApi(counselToken, deadline.id, {
        remindAt: '2020-01-01T09:00:00.000Z',
      });

      await request(app.getHttpServer())
        .post('/api/v1/reminders/process-due')
        .set(authHeader(adminToken))
        .expect(200);

      const log = await getTestPrisma().activityLog.findFirst({
        where: {
          entityType: EntityType.REMINDER,
          entityId: reminder.id,
          action: AuditAction.REMINDER_SENT,
        },
      });

      expect(log).toBeTruthy();
    });
  });

  describe('Counsel isolation', () => {
    it('counsel2 cannot GET reminder on counsel case deadline', async () => {
      const { deadline } = await createDeadlineViaApi(counselToken, {
        assigneeId: counselId,
      });
      const reminder = await createReminderViaApi(counselToken, deadline.id);

      await request(app.getHttpServer())
        .get(`/api/v1/reminders/${reminder.id}`)
        .set(authHeader(counsel2Token))
        .expect(403);
    });

    it('viewer can GET but not create reminders', async () => {
      const { deadline } = await createDeadlineViaApi(counselToken);
      const reminders = await getTestPrisma().reminder.findMany({
        where: { deadlineId: deadline.id },
      });

      await request(app.getHttpServer())
        .get(`/api/v1/reminders/${reminders[0].id}`)
        .set(authHeader(viewerToken))
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/v1/reminders')
        .set(authHeader(viewerToken))
        .send({
          deadlineId: deadline.id,
          remindAt: '2026-07-20T09:00:00.000Z',
        })
        .expect(403);
    });
  });
});
