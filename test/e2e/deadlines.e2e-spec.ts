import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  AuditAction,
  CaseStatus,
  CaseType,
  ContractType,
  DeadlineStatus,
  EntityType,
  Priority,
} from '@prisma/client';
import { DeadlineView } from '../../src/modules/deadlines/domain/deadline-view.enum';
import { formatDateInTimezone } from '../../src/shared/utils/date-boundary.util';
import { authHeader, loginAs } from '../helpers/auth.helper';
import { createTestApp } from '../helpers/app.helper';
import {
  cleanupTestCases,
  cleanupTestContracts,
  cleanupTestDeadlines,
  cleanupTestNotices,
  deleteUserByEmail,
  disconnectTestPrisma,
  getTestPrisma,
  getUserIdByEmail,
  seedTestUsers,
  upsertInactiveUser,
} from '../helpers/db.helper';

const APP_TIMEZONE = 'Asia/Tehran';

function addDaysToYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

describe('Deadlines (e2e)', () => {
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
    await cleanupTestDeadlines();
    await cleanupTestNotices();
    await cleanupTestCases();
    await cleanupTestContracts();
    await refreshAuthContext();
  });

  afterAll(async () => {
    await cleanupTestDeadlines();
    await cleanupTestNotices();
    await cleanupTestCases();
    await cleanupTestContracts();
    await deleteUserByEmail('inactive@legal.local');
    await app.close();
    await disconnectTestPrisma();
  });

  async function createCaseViaApi(
    token: string,
    overrides: Record<string, unknown> = {},
  ) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/cases')
      .set(authHeader(token))
      .send({
        title: 'Deadline Parent Case',
        type: CaseType.LITIGATION,
        status: CaseStatus.OPEN,
        priority: Priority.MEDIUM,
        ...overrides,
      })
      .expect(201);
    return res.body.data;
  }

  async function createDeadlineViaApi(
    token: string,
    overrides: Record<string, unknown> = {},
  ) {
    const legalCase =
      overrides.caseId !== undefined
        ? { id: overrides.caseId }
        : await createCaseViaApi(token);

    const res = await request(app.getHttpServer())
      .post('/api/v1/deadlines')
      .set(authHeader(token))
      .send({
        title: 'E2E Deadline',
        dueDate: '2026-08-01',
        assigneeId: counselId,
        caseId: legalCase.id,
        ...overrides,
      })
      .expect(201);

    return res.body.data;
  }

  describe('Auth and RBAC', () => {
    it('returns 401 for unauthenticated list request', async () => {
      await request(app.getHttpServer()).get('/api/v1/deadlines').expect(401);
    });

    it('returns 403 when viewer tries to create a deadline', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      await request(app.getHttpServer())
        .post('/api/v1/deadlines')
        .set(authHeader(viewerToken))
        .send({
          title: 'Viewer Deadline',
          dueDate: '2026-08-01',
          caseId: legalCase.id,
        })
        .expect(403);
    });

    it('allows counsel to create a deadline on own case', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const created = await createDeadlineViaApi(counselToken, {
        caseId: legalCase.id,
        title: 'Counsel Deadline',
      });

      expect(created.title).toBe('Counsel Deadline');
      expect(created.status).toBe(DeadlineStatus.PENDING);
      expect(created.caseId).toBe(legalCase.id);
    });

    it('allows manager to create a deadline on counsel case', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const created = await createDeadlineViaApi(managerToken, {
        caseId: legalCase.id,
        assigneeId: counsel2Id,
      });

      expect(created.assigneeId).toBe(counsel2Id);
    });
  });

  describe('Validation', () => {
    it('returns 400 when no parent is provided', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/deadlines')
        .set(authHeader(counselToken))
        .send({ title: 'No Parent', dueDate: '2026-08-01' })
        .expect(400);
    });

    it('returns 400 when multiple parents are provided', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const contractRes = await request(app.getHttpServer())
        .post('/api/v1/contracts')
        .set(authHeader(counselToken))
        .send({
          title: 'Deadline Contract',
          type: ContractType.MSA,
          counterpartyName: 'Acme',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/deadlines')
        .set(authHeader(counselToken))
        .send({
          title: 'Multi Parent',
          dueDate: '2026-08-01',
          caseId: legalCase.id,
          contractId: contractRes.body.data.id,
        })
        .expect(400);
    });

    it('returns 404 when assignee is inactive', async () => {
      await upsertInactiveUser();
      const inactiveId = await getUserIdByEmail('inactive@legal.local');
      const legalCase = await createCaseViaApi(counselToken);

      await request(app.getHttpServer())
        .post('/api/v1/deadlines')
        .set(authHeader(counselToken))
        .send({
          title: 'Inactive Assignee',
          dueDate: '2026-08-01',
          caseId: legalCase.id,
          assigneeId: inactiveId,
        })
        .expect(404);
    });

    it('returns 400 for invalid UUID in GET path', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/deadlines/not-a-uuid')
        .set(authHeader(counselToken))
        .expect(400);
    });
  });

  describe('List views', () => {
    beforeEach(async () => {
      const today = formatDateInTimezone(new Date(), APP_TIMEZONE);
      const yesterday = addDaysToYmd(today, -1);
      const tomorrow = addDaysToYmd(today, 1);
      const prisma = getTestPrisma();

      const legalCase = await prisma.legalCase.create({
        data: {
          referenceCode: `CASE-DL-${Date.now()}`,
          title: 'Deadline View Case',
          type: CaseType.LITIGATION,
          status: CaseStatus.OPEN,
          priority: Priority.HIGH,
          ownerId: counselId,
        },
      });

      await prisma.deadline.createMany({
        data: [
          {
            title: 'Overdue Deadline',
            dueDate: new Date(`${yesterday}T00:00:00.000Z`),
            status: DeadlineStatus.PENDING,
            caseId: legalCase.id,
            assigneeId: counsel2Id,
            createdById: counselId,
          },
          {
            title: 'Today Deadline',
            dueDate: new Date(`${today}T00:00:00.000Z`),
            status: DeadlineStatus.PENDING,
            caseId: legalCase.id,
            assigneeId: counselId,
            createdById: counselId,
          },
          {
            title: 'Upcoming Deadline',
            dueDate: new Date(`${tomorrow}T00:00:00.000Z`),
            status: DeadlineStatus.PENDING,
            caseId: legalCase.id,
            createdById: counselId,
          },
        ],
      });
    });

    it('filters overdue view', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/deadlines')
        .query({ view: DeadlineView.OVERDUE })
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Overdue Deadline');
    });

    it('filters today view', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/deadlines')
        .query({ view: DeadlineView.TODAY })
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Today Deadline');
    });

    it('filters upcoming view', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/deadlines')
        .query({ view: DeadlineView.UPCOMING })
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Upcoming Deadline');
    });

    it('filters assigned-to-me view for counsel', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/deadlines')
        .query({ view: DeadlineView.ASSIGNED_TO_ME })
        .set(authHeader(counselToken))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Today Deadline');
      expect(res.body.data[0].assigneeId).toBe(counselId);
    });
  });

  describe('Deadline lifecycle', () => {
    it('create → get → patch → complete → cancel (DELETE)', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const created = await createDeadlineViaApi(counselToken, {
        caseId: legalCase.id,
      });

      const fetched = await request(app.getHttpServer())
        .get(`/api/v1/deadlines/${created.id}`)
        .set(authHeader(counselToken))
        .expect(200);
      expect(fetched.body.data.id).toBe(created.id);

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/deadlines/${created.id}`)
        .set(authHeader(counselToken))
        .send({ title: 'Renamed Deadline', dueDate: '2026-08-15' })
        .expect(200);
      expect(updated.body.data.title).toBe('Renamed Deadline');

      const completed = await request(app.getHttpServer())
        .patch(`/api/v1/deadlines/${created.id}`)
        .set(authHeader(counselToken))
        .send({ status: DeadlineStatus.COMPLETED })
        .expect(200);
      expect(completed.body.data.status).toBe(DeadlineStatus.COMPLETED);
      expect(completed.body.data.completedAt).toBeTruthy();

      await request(app.getHttpServer())
        .delete(`/api/v1/deadlines/${created.id}`)
        .set(authHeader(managerToken))
        .expect(200)
        .expect({ data: { success: true } });

      const dbDeadline = await getTestPrisma().deadline.findUnique({
        where: { id: created.id },
      });
      expect(dbDeadline?.status).toBe(DeadlineStatus.CANCELLED);
    });

    it('generates CREATED, UPDATED, DEADLINE_COMPLETED, and DELETED activity logs', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const created = await createDeadlineViaApi(counselToken, {
        caseId: legalCase.id,
      });

      await request(app.getHttpServer())
        .patch(`/api/v1/deadlines/${created.id}`)
        .set(authHeader(counselToken))
        .send({ title: 'Logged Title' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/v1/deadlines/${created.id}`)
        .set(authHeader(counselToken))
        .send({ status: DeadlineStatus.COMPLETED })
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/api/v1/deadlines/${created.id}`)
        .set(authHeader(managerToken))
        .expect(200);

      const logs = await getTestPrisma().activityLog.findMany({
        where: { entityType: EntityType.DEADLINE, entityId: created.id },
        orderBy: { createdAt: 'asc' },
      });

      const actions = logs.map((log) => log.action);
      expect(actions).toContain(AuditAction.CREATED);
      expect(actions).toContain(AuditAction.UPDATED);
      expect(actions).toContain(AuditAction.DEADLINE_COMPLETED);
      expect(actions).toContain(AuditAction.DELETED);
    });
  });

  describe('Counsel isolation', () => {
    it('counsel2 cannot GET deadline on counsel case when not assigned', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const created = await createDeadlineViaApi(counselToken, {
        caseId: legalCase.id,
        assigneeId: counselId,
      });

      await request(app.getHttpServer())
        .get(`/api/v1/deadlines/${created.id}`)
        .set(authHeader(counsel2Token))
        .expect(403);
    });

    it('assignee counsel2 can PATCH deadline on counsel case', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const created = await createDeadlineViaApi(counselToken, {
        caseId: legalCase.id,
        assigneeId: counsel2Id,
      });

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/deadlines/${created.id}`)
        .set(authHeader(counsel2Token))
        .send({ title: 'Updated by assignee' })
        .expect(200);
      expect(updated.body.data.title).toBe('Updated by assignee');
    });

    it('assignee counsel2 cannot DELETE deadline they do not own', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const created = await createDeadlineViaApi(counselToken, {
        caseId: legalCase.id,
        assigneeId: counsel2Id,
      });

      await request(app.getHttpServer())
        .delete(`/api/v1/deadlines/${created.id}`)
        .set(authHeader(counsel2Token))
        .expect(403);
    });

    it('viewer can GET any deadline but not mutate', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const created = await createDeadlineViaApi(counselToken, {
        caseId: legalCase.id,
      });

      await request(app.getHttpServer())
        .get(`/api/v1/deadlines/${created.id}`)
        .set(authHeader(viewerToken))
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/v1/deadlines/${created.id}`)
        .set(authHeader(viewerToken))
        .send({ title: 'Viewer Edit' })
        .expect(403);
    });
  });
});
