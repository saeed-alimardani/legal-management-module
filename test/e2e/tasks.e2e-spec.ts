import { INestApplication } from '@nestjs/common';
import {
  AuditAction,
  CaseStatus,
  CaseType,
  ContractType,
  EntityType,
  Priority,
  TaskStatus,
} from '@prisma/client';
import request from 'supertest';
import { authHeader, loginAs } from '../helpers/auth.helper';
import { createTestApp } from '../helpers/app.helper';
import {
  cleanupTestCases,
  cleanupTestContracts,
  cleanupTestDocuments,
  cleanupTestNotices,
  cleanupTestTasks,
  deleteUserByEmail,
  disconnectTestPrisma,
  getTestPrisma,
  getUserIdByEmail,
  seedTestUsers,
  upsertInactiveUser,
} from '../helpers/db.helper';

describe('Tasks (e2e)', () => {
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
    await cleanupTestTasks();
    await cleanupTestDocuments();
    await cleanupTestNotices();
    await cleanupTestCases();
    await cleanupTestContracts();
    await refreshAuthContext();
  });

  afterAll(async () => {
    await cleanupTestTasks();
    await cleanupTestDocuments();
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
        title: 'Task Parent Case',
        type: CaseType.LITIGATION,
        status: CaseStatus.OPEN,
        priority: Priority.MEDIUM,
        ...overrides,
      })
      .expect(201);
    return res.body.data;
  }

  async function createContractViaApi(
    token: string,
    overrides: Record<string, unknown> = {},
  ) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/contracts')
      .set(authHeader(token))
      .send({
        title: 'Task Parent Contract',
        type: ContractType.MSA,
        counterpartyName: 'Acme Corp',
        ...overrides,
      })
      .expect(201);
    return res.body.data;
  }

  async function createNoticeViaApi(
    token: string,
    overrides: Record<string, unknown> = {},
  ) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/notices')
      .set(authHeader(token))
      .send({
        title: 'Task Parent Notice',
        sender: 'Vendor X',
        receivedDate: '2026-07-01',
        responseDeadline: '2026-07-15',
        ...overrides,
      })
      .expect(201);
    return res.body.data;
  }

  async function createTaskViaApi(
    token: string,
    overrides: Record<string, unknown> = {},
  ) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tasks')
      .set(authHeader(token))
      .send({
        title: 'E2E Task',
        assigneeId: counselId,
        ...overrides,
      })
      .expect(201);
    return res.body.data;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Auth and RBAC
  // ──────────────────────────────────────────────────────────────────────────
  describe('Auth and RBAC', () => {
    it('returns 401 for unauthenticated list request', async () => {
      await request(app.getHttpServer()).get('/api/v1/tasks').expect(401);
    });

    it('returns 403 when viewer tries to create a task', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set(authHeader(viewerToken))
        .send({
          title: 'Viewer task',
          assigneeId: counselId,
          caseId: legalCase.id,
        })
        .expect(403);
    });

    it('allows counsel to create a task (201)', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const res = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set(authHeader(counselToken))
        .send({
          title: 'Counsel Task',
          assigneeId: counselId,
          caseId: legalCase.id,
        })
        .expect(201);
      expect(res.body.data.title).toBe('Counsel Task');
      expect(res.body.data.status).toBe(TaskStatus.TODO);
      expect(res.body.data.createdById).toBe(counselId);
    });

    it('allows manager to create a task on counsel case', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const res = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set(authHeader(managerToken))
        .send({
          title: 'Manager Task',
          assigneeId: counsel2Id,
          caseId: legalCase.id,
        })
        .expect(201);
      expect(res.body.data.assigneeId).toBe(counsel2Id);
    });

    it('allows admin to create a task', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const res = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set(authHeader(adminToken))
        .send({
          title: 'Admin Task',
          assigneeId: counselId,
          caseId: legalCase.id,
        })
        .expect(201);
      expect(res.body.data.title).toBe('Admin Task');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Validation
  // ──────────────────────────────────────────────────────────────────────────
  describe('Validation', () => {
    it('returns 400 when no parent is provided', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set(authHeader(counselToken))
        .send({ title: 'No Parent', assigneeId: counselId })
        .expect(400);
    });

    it('returns 400 when multiple parents are provided', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const contract = await createContractViaApi(counselToken);
      await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set(authHeader(counselToken))
        .send({
          title: 'Multi Parent',
          assigneeId: counselId,
          caseId: legalCase.id,
          contractId: contract.id,
        })
        .expect(400);
    });

    it('returns 400 when assigneeId is missing', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set(authHeader(counselToken))
        .send({ title: 'No Assignee', caseId: legalCase.id })
        .expect(400);
    });

    it('returns 404 when assignee is inactive', async () => {
      await upsertInactiveUser();
      const inactiveId = await getUserIdByEmail('inactive@legal.local');
      const legalCase = await createCaseViaApi(counselToken);
      await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set(authHeader(counselToken))
        .send({
          title: 'Inactive Assignee',
          assigneeId: inactiveId,
          caseId: legalCase.id,
        })
        .expect(404);
    });

    it('returns 400 for invalid UUID in GET path', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/tasks/not-a-uuid')
        .set(authHeader(counselToken))
        .expect(400);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Parent types
  // ──────────────────────────────────────────────────────────────────────────
  describe('Parent types', () => {
    it('creates a task on a contract', async () => {
      const contract = await createContractViaApi(counselToken);
      const res = await createTaskViaApi(counselToken, {
        title: 'Contract Task',
        contractId: contract.id,
      });
      expect(res.contractId).toBe(contract.id);
      expect(res.caseId).toBeNull();
    });

    it('creates a task on a notice', async () => {
      const notice = await createNoticeViaApi(counselToken);
      const res = await createTaskViaApi(counselToken, {
        title: 'Notice Task',
        noticeId: notice.id,
      });
      expect(res.noticeId).toBe(notice.id);
      expect(res.caseId).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Lifecycle
  // ──────────────────────────────────────────────────────────────────────────
  describe('Task lifecycle', () => {
    it('create → get → patch title → DONE (completedAt set) → IN_PROGRESS (completedAt null) → delete → soft-deleted in DB', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const task = await createTaskViaApi(counselToken, {
        caseId: legalCase.id,
      });

      // GET
      const fetched = await request(app.getHttpServer())
        .get(`/api/v1/tasks/${task.id}`)
        .set(authHeader(counselToken))
        .expect(200);
      expect(fetched.body.data.id).toBe(task.id);

      // PATCH title → UPDATED log
      const titled = await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${task.id}`)
        .set(authHeader(counselToken))
        .send({ title: 'Renamed Task' })
        .expect(200);
      expect(titled.body.data.title).toBe('Renamed Task');

      // PATCH to DONE → completedAt is truthy
      const done = await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${task.id}`)
        .set(authHeader(counselToken))
        .send({ status: TaskStatus.DONE })
        .expect(200);
      expect(done.body.data.status).toBe(TaskStatus.DONE);
      expect(done.body.data.completedAt).toBeTruthy();

      // Reopen IN_PROGRESS → completedAt cleared
      const reopened = await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${task.id}`)
        .set(authHeader(counselToken))
        .send({ status: TaskStatus.IN_PROGRESS })
        .expect(200);
      expect(reopened.body.data.status).toBe(TaskStatus.IN_PROGRESS);
      expect(reopened.body.data.completedAt).toBeNull();

      // Delete (DELETE) → returns success
      await request(app.getHttpServer())
        .delete(`/api/v1/tasks/${task.id}`)
        .set(authHeader(counselToken))
        .expect(200)
        .expect({ data: { success: true } });

      // DB confirms soft-delete (status preserved, deletedAt set)
      const dbTask = await getTestPrisma().task.findUnique({
        where: { id: task.id },
      });
      expect(dbTask?.status).toBe(TaskStatus.IN_PROGRESS);
      expect(dbTask?.deletedAt).not.toBeNull();

      // GET after delete → 404
      await request(app.getHttpServer())
        .get(`/api/v1/tasks/${task.id}`)
        .set(authHeader(counselToken))
        .expect(404);
    });

    it('generates CREATED, UPDATED, STATUS_CHANGED, and DELETED activity logs', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const task = await createTaskViaApi(counselToken, {
        caseId: legalCase.id,
      });

      await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${task.id}`)
        .set(authHeader(counselToken))
        .send({ title: 'New Title' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${task.id}`)
        .set(authHeader(counselToken))
        .send({ status: TaskStatus.DONE })
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/api/v1/tasks/${task.id}`)
        .set(authHeader(counselToken))
        .expect(200);

      const logs = await getTestPrisma().activityLog.findMany({
        where: { entityType: EntityType.TASK, entityId: task.id },
        orderBy: { createdAt: 'asc' },
      });

      const actions = logs.map((l) => l.action);
      expect(actions).toContain(AuditAction.CREATED);
      expect(actions).toContain(AuditAction.UPDATED);
      expect(actions).toContain(AuditAction.STATUS_CHANGED);
      expect(actions).toContain(AuditAction.DELETED);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Permissions
  // ──────────────────────────────────────────────────────────────────────────
  describe('Task permissions', () => {
    it('assignee (counsel2) can PATCH a task they are assigned to', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const task = await createTaskViaApi(counselToken, {
        caseId: legalCase.id,
        assigneeId: counsel2Id,
      });

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${task.id}`)
        .set(authHeader(counsel2Token))
        .send({ title: 'Updated by assignee' })
        .expect(200);
      expect(updated.body.data.title).toBe('Updated by assignee');
    });

    it('counsel2 who is assignee but not creator cannot DELETE the task', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const task = await createTaskViaApi(counselToken, {
        caseId: legalCase.id,
        assigneeId: counsel2Id,
      });

      await request(app.getHttpServer())
        .delete(`/api/v1/tasks/${task.id}`)
        .set(authHeader(counsel2Token))
        .expect(403);
    });

    it('manager can DELETE any task', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const task = await createTaskViaApi(counselToken, {
        caseId: legalCase.id,
      });

      await request(app.getHttpServer())
        .delete(`/api/v1/tasks/${task.id}`)
        .set(authHeader(managerToken))
        .expect(200)
        .expect({ data: { success: true } });
    });

    it('creator (counsel) can DELETE their own task', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const task = await createTaskViaApi(counselToken, {
        caseId: legalCase.id,
      });

      await request(app.getHttpServer())
        .delete(`/api/v1/tasks/${task.id}`)
        .set(authHeader(counselToken))
        .expect(200);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Isolation
  // ──────────────────────────────────────────────────────────────────────────
  describe('Counsel isolation', () => {
    it('counsel2 cannot GET a task on counsel case when not assigned', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      // assigneeId defaults to counselId via createTaskViaApi helper
      const task = await createTaskViaApi(counselToken, {
        caseId: legalCase.id,
      });

      await request(app.getHttpServer())
        .get(`/api/v1/tasks/${task.id}`)
        .set(authHeader(counsel2Token))
        .expect(403);
    });

    it('counsel list is scoped: only own-matter and assigned tasks appear', async () => {
      const case1 = await createCaseViaApi(counselToken);
      const case2 = await createCaseViaApi(counsel2Token);

      await createTaskViaApi(counselToken, {
        caseId: case1.id,
        title: 'Counsel Task',
      });
      // counsel2's task — must explicitly set assigneeId to avoid defaulting to counselId
      await createTaskViaApi(counsel2Token, {
        caseId: case2.id,
        title: 'Counsel2 Task',
        assigneeId: counsel2Id,
      });

      const counsel1List = await request(app.getHttpServer())
        .get('/api/v1/tasks')
        .set(authHeader(counselToken))
        .expect(200);

      expect(counsel1List.body.data).toHaveLength(1);
      expect(counsel1List.body.data[0].title).toBe('Counsel Task');
    });

    it('viewer can GET any task', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const task = await createTaskViaApi(counselToken, {
        caseId: legalCase.id,
      });

      await request(app.getHttpServer())
        .get(`/api/v1/tasks/${task.id}`)
        .set(authHeader(viewerToken))
        .expect(200);
    });

    it('assignee (counsel2) can GET a task on counsel case', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const task = await createTaskViaApi(counselToken, {
        caseId: legalCase.id,
        assigneeId: counsel2Id,
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/tasks/${task.id}`)
        .set(authHeader(counsel2Token))
        .expect(200);
      expect(res.body.data.assigneeId).toBe(counsel2Id);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. List filters
  // ──────────────────────────────────────────────────────────────────────────
  describe('List filters', () => {
    it('filters by status', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      await createTaskViaApi(counselToken, {
        caseId: legalCase.id,
        title: 'TODO task',
      });
      const taskToDone = await createTaskViaApi(counselToken, {
        caseId: legalCase.id,
        title: 'DONE task',
      });

      await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${taskToDone.id}`)
        .set(authHeader(counselToken))
        .send({ status: TaskStatus.DONE })
        .expect(200);

      const filtered = await request(app.getHttpServer())
        .get('/api/v1/tasks')
        .query({ status: TaskStatus.DONE, caseId: legalCase.id })
        .set(authHeader(adminToken))
        .expect(200);

      expect(filtered.body.data).toHaveLength(1);
      expect(filtered.body.data[0].title).toBe('DONE task');
    });

    it('filters by assigneeId', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      await createTaskViaApi(counselToken, {
        caseId: legalCase.id,
        assigneeId: counselId,
      });
      await createTaskViaApi(counselToken, {
        caseId: legalCase.id,
        title: 'Assigned to counsel2',
        assigneeId: counsel2Id,
      });

      const filtered = await request(app.getHttpServer())
        .get('/api/v1/tasks')
        .query({ assigneeId: counsel2Id })
        .set(authHeader(adminToken))
        .expect(200);

      expect(filtered.body.data).toHaveLength(1);
      expect(filtered.body.data[0].assigneeId).toBe(counsel2Id);
    });

    it('returns correct pagination meta', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      await createTaskViaApi(counselToken, {
        caseId: legalCase.id,
        title: 'Task A',
      });
      await createTaskViaApi(counselToken, {
        caseId: legalCase.id,
        title: 'Task B',
      });
      await createTaskViaApi(counselToken, {
        caseId: legalCase.id,
        title: 'Task C',
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/tasks')
        .query({ page: 1, limit: 2, caseId: legalCase.id })
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toEqual({ page: 1, limit: 2, total: 3 });
    });
  });
});
