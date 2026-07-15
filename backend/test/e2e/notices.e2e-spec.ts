import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  AuditAction,
  CaseStatus,
  CaseType,
  DeadlineStatus,
  EntityType,
  NoticeStatus,
  Priority,
} from '@prisma/client';
import { authHeader, loginAs } from '../helpers/auth.helper';
import { createTestApp } from '../helpers/app.helper';
import {
  cleanupTestCases,
  cleanupTestContracts,
  cleanupTestNotices,
  disconnectTestPrisma,
  getTestPrisma,
  getUserIdByEmail,
  seedTestUsers,
} from '../helpers/db.helper';

describe('Notices (e2e)', () => {
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
    await cleanupTestNotices();
    await cleanupTestCases();
    await cleanupTestContracts();
    await refreshAuthContext();
  });

  afterAll(async () => {
    await cleanupTestNotices();
    await cleanupTestCases();
    await cleanupTestContracts();
    await app.close();
    await disconnectTestPrisma();
  });

  async function createNoticeViaApi(
    token: string,
    overrides: Record<string, unknown> = {},
  ) {
    const payload = {
      title: 'E2E Demand Letter',
      sender: 'Vendor X Legal',
      receivedDate: '2026-07-01',
      responseDeadline: '2026-07-15',
      description: 'Created during e2e tests',
      ...overrides,
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/notices')
      .set(authHeader(token))
      .send(payload)
      .expect(201);

    return response.body.data;
  }

  describe('RBAC and authentication', () => {
    it('returns 401 for unauthenticated list request', async () => {
      await request(app.getHttpServer()).get('/api/v1/notices').expect(401);
    });

    it('returns 403 when viewer tries to create a notice', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/notices')
        .set(authHeader(viewerToken))
        .send({
          title: 'Viewer Notice',
          sender: 'X',
          receivedDate: '2026-07-01',
          responseDeadline: '2026-07-15',
        })
        .expect(403);
    });

    it('allows counsel to create a notice with Persian dates', async () => {
      const created = await createNoticeViaApi(counselToken);

      expect(created).toMatchObject({
        title: 'E2E Demand Letter',
        sender: 'Vendor X Legal',
        status: NoticeStatus.RECEIVED,
        ownerId: counselId,
      });
      expect(created.referenceCode).toMatch(/^NTC-\d{4}-\d{5}$/);
      expect(created.receivedDatePersian).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
      expect(created.responseDeadlinePersian).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    });

    it('returns 400 when responseDeadline is before receivedDate', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/notices')
        .set(authHeader(counselToken))
        .send({
          title: 'Bad Dates',
          sender: 'X',
          receivedDate: '2026-07-15',
          responseDeadline: '2026-07-01',
        })
        .expect(400);
    });
  });

  describe('Notice + auto-deadline', () => {
    it('POST notice creates deadline with matching dueDate and dual activity logs', async () => {
      const created = await createNoticeViaApi(counselToken, {
        responseDeadline: '2026-07-20',
      });

      const deadlines = await getTestPrisma().deadline.findMany({
        where: { noticeId: created.id },
      });

      expect(deadlines).toHaveLength(1);
      expect(deadlines[0].dueDate.toISOString().slice(0, 10)).toBe(
        '2026-07-20',
      );
      expect(deadlines[0].status).toBe(DeadlineStatus.PENDING);
      expect(deadlines[0].title).toBe('Response deadline: E2E Demand Letter');
      expect(deadlines[0].assigneeId).toBe(counselId);
      expect(deadlines[0].createdById).toBe(counselId);

      const noticeLogs = await getTestPrisma().activityLog.findMany({
        where: {
          entityType: EntityType.NOTICE,
          entityId: created.id,
        },
      });
      const deadlineLogs = await getTestPrisma().activityLog.findMany({
        where: {
          entityType: EntityType.DEADLINE,
          entityId: deadlines[0].id,
        },
      });

      expect(noticeLogs).toHaveLength(1);
      expect(noticeLogs[0].action).toBe(AuditAction.CREATED);
      expect(deadlineLogs).toHaveLength(1);
      expect(deadlineLogs[0].metadata).toMatchObject({
        autoCreated: true,
        noticeId: created.id,
      });
    });

    it('links related case and contract when provided', async () => {
      const prisma = getTestPrisma();
      const legalCase = await prisma.legalCase.create({
        data: {
          referenceCode: `CASE-${new Date().getFullYear()}-88001`,
          title: 'Related Case',
          type: CaseType.LITIGATION,
          status: CaseStatus.OPEN,
          priority: Priority.HIGH,
          ownerId: counselId,
        },
      });
      const contract = await prisma.contract.create({
        data: {
          referenceCode: `CTR-${new Date().getFullYear()}-88001`,
          title: 'Related Contract',
          type: 'MSA',
          status: 'ACTIVE',
          ownerId: counselId,
          counterpartyName: 'Acme',
        },
      });

      const created = await createNoticeViaApi(counselToken, {
        relatedCaseId: legalCase.id,
        relatedContractId: contract.id,
      });

      expect(created.relatedCaseId).toBe(legalCase.id);
      expect(created.relatedContractId).toBe(contract.id);
    });

    it('returns 404 for missing related case', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/notices')
        .set(authHeader(counselToken))
        .send({
          title: 'Missing Case',
          sender: 'X',
          receivedDate: '2026-07-01',
          responseDeadline: '2026-07-15',
          relatedCaseId: '11111111-1111-4111-8111-111111111111',
        })
        .expect(404);
    });
  });

  describe('Notice lifecycle', () => {
    it('create → get → update status → activity log entry exists', async () => {
      const created = await createNoticeViaApi(counselToken);

      const fetched = await request(app.getHttpServer())
        .get(`/api/v1/notices/${created.id}`)
        .set(authHeader(counselToken))
        .expect(200);

      expect(fetched.body.data.id).toBe(created.id);
      expect(fetched.body.data.responseDeadlinePersian).toMatch(
        /^\d{4}\/\d{2}\/\d{2}$/,
      );

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/notices/${created.id}`)
        .set(authHeader(counselToken))
        .send({ status: NoticeStatus.UNDER_REVIEW, title: 'Under Review' })
        .expect(200);

      expect(updated.body.data.status).toBe(NoticeStatus.UNDER_REVIEW);

      const logs = await getTestPrisma().activityLog.findMany({
        where: {
          entityType: EntityType.NOTICE,
          entityId: created.id,
        },
        orderBy: { createdAt: 'asc' },
      });

      expect(logs.map((log) => log.action)).toEqual(
        expect.arrayContaining([
          AuditAction.CREATED,
          AuditAction.STATUS_CHANGED,
        ]),
      );
    });

    it('soft deletes notice and hides it from list/get', async () => {
      const created = await createNoticeViaApi(counselToken);

      await request(app.getHttpServer())
        .delete(`/api/v1/notices/${created.id}`)
        .set(authHeader(managerToken))
        .expect(200)
        .expect({ data: { success: true } });

      await request(app.getHttpServer())
        .get(`/api/v1/notices/${created.id}`)
        .set(authHeader(adminToken))
        .expect(404);

      const list = await request(app.getHttpServer())
        .get('/api/v1/notices')
        .set(authHeader(adminToken))
        .expect(200);

      expect(list.body.data).toHaveLength(0);
    });

    it('denies counsel from deleting even own notice', async () => {
      const created = await createNoticeViaApi(counselToken);

      await request(app.getHttpServer())
        .delete(`/api/v1/notices/${created.id}`)
        .set(authHeader(counselToken))
        .expect(403);
    });
  });

  describe('Counsel isolation', () => {
    it('counsel1 cannot GET counsel2 notice', async () => {
      const created = await createNoticeViaApi(counsel2Token, {
        title: 'Counsel2 Private Notice',
      });

      await request(app.getHttpServer())
        .get(`/api/v1/notices/${created.id}`)
        .set(authHeader(counselToken))
        .expect(403);
    });

    it('counsel list only returns own notices', async () => {
      await createNoticeViaApi(counselToken, { title: 'Counsel1 Notice' });
      await createNoticeViaApi(counsel2Token, { title: 'Counsel2 Notice' });

      const counsel1List = await request(app.getHttpServer())
        .get('/api/v1/notices')
        .set(authHeader(counselToken))
        .expect(200);

      expect(counsel1List.body.data).toHaveLength(1);
      expect(counsel1List.body.data[0].title).toBe('Counsel1 Notice');

      const adminList = await request(app.getHttpServer())
        .get('/api/v1/notices')
        .set(authHeader(adminToken))
        .expect(200);

      expect(adminList.body.data).toHaveLength(2);
    });

    it('allows viewer to read all notices but not mutate', async () => {
      const created = await createNoticeViaApi(counselToken);

      await request(app.getHttpServer())
        .get(`/api/v1/notices/${created.id}`)
        .set(authHeader(viewerToken))
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/v1/notices/${created.id}`)
        .set(authHeader(viewerToken))
        .send({ title: 'Viewer Edit' })
        .expect(403);
    });
  });

  describe('Reassign ownership', () => {
    it('manager reassigns notice and logs REASSIGNED', async () => {
      const created = await createNoticeViaApi(counselToken);

      const reassigned = await request(app.getHttpServer())
        .post(`/api/v1/notices/${created.id}/reassign`)
        .set(authHeader(managerToken))
        .send({ ownerId: counsel2Id })
        .expect(201);

      expect(reassigned.body.data.ownerId).toBe(counsel2Id);

      const log = await getTestPrisma().activityLog.findFirst({
        where: {
          entityId: created.id,
          action: AuditAction.REASSIGNED,
        },
      });

      expect(log?.metadata).toMatchObject({
        fromUserId: counselId,
        toUserId: counsel2Id,
      });
    });

    it('denies counsel from reassigning', async () => {
      const created = await createNoticeViaApi(counselToken);

      await request(app.getHttpServer())
        .post(`/api/v1/notices/${created.id}/reassign`)
        .set(authHeader(counselToken))
        .send({ ownerId: counsel2Id })
        .expect(403);
    });
  });

  describe('List filters', () => {
    it('filters by status for admin', async () => {
      await createNoticeViaApi(counselToken, {
        title: 'Received Notice',
        status: NoticeStatus.RECEIVED,
      });
      await createNoticeViaApi(counselToken, {
        title: 'Overdue Notice',
        status: NoticeStatus.OVERDUE,
        receivedDate: '2026-06-01',
        responseDeadline: '2026-06-10',
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/notices')
        .query({ status: NoticeStatus.OVERDUE })
        .set(authHeader(adminToken))
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Overdue Notice');
    });
  });
});
