import { INestApplication } from '@nestjs/common';
import {
  AuditAction,
  CaseStatus,
  CaseType,
  ContractType,
  DocumentType,
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
  disconnectTestPrisma,
  getUserIdByEmail,
  seedTestUsers,
} from '../helpers/db.helper';

describe('Activity Logs (e2e)', () => {
  let app: INestApplication;
  let counselToken: string;
  let counsel2Token: string;
  let managerToken: string;
  let adminToken: string;
  let viewerToken: string;
  let counselId: string;

  async function refreshAuthContext(): Promise<void> {
    await seedTestUsers();
    counselId = await getUserIdByEmail('counsel@legal.local');
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
        title: 'Activity Log Case',
        type: CaseType.LITIGATION,
        status: CaseStatus.OPEN,
        priority: Priority.HIGH,
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
        title: 'Activity Log Contract',
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
        title: 'Activity Log Notice',
        sender: 'Vendor',
        receivedDate: '2026-07-01',
        responseDeadline: '2026-07-15',
        ...overrides,
      })
      .expect(201);
    return res.body.data;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Authentication
  // ──────────────────────────────────────────────────────────────────────────
  describe('Authentication', () => {
    it('returns 401 without JWT', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/activity-logs')
        .expect(401);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Entity timelines
  // ──────────────────────────────────────────────────────────────────────────
  describe('Entity timelines', () => {
    it('CASE timeline shows CREATED and STATUS_CHANGED; manager update visible to owner', async () => {
      const legalCase = await createCaseViaApi(counselToken);

      await request(app.getHttpServer())
        .patch(`/api/v1/cases/${legalCase.id}`)
        .set(authHeader(managerToken))
        .send({ status: CaseStatus.IN_PROGRESS })
        .expect(200);

      const timeline = await request(app.getHttpServer())
        .get('/api/v1/activity-logs')
        .query({ entityType: EntityType.CASE, entityId: legalCase.id })
        .set(authHeader(counselToken))
        .expect(200);

      expect(timeline.body.data.length).toBeGreaterThanOrEqual(2);
      const actions = (timeline.body.data as { action: string }[]).map(
        (e) => e.action,
      );
      expect(actions).toContain(AuditAction.CREATED);
      expect(actions).toContain(AuditAction.STATUS_CHANGED);
      // Manager's entry is visible to the case owner via scoped query (skipCounselActorScope=true)
      expect(
        (timeline.body.data as { actorId: string }[]).some(
          (e) => e.actorId !== counselId,
        ),
      ).toBe(true);
    });

    it('returns 403 when counsel2 requests timeline for counsel case', async () => {
      const legalCase = await createCaseViaApi(counselToken);

      await request(app.getHttpServer())
        .get('/api/v1/activity-logs')
        .query({ entityType: EntityType.CASE, entityId: legalCase.id })
        .set(authHeader(counsel2Token))
        .expect(403);
    });

    it('TASK entity timeline shows CREATED log after task is created', async () => {
      const legalCase = await createCaseViaApi(counselToken);

      const taskRes = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set(authHeader(counselToken))
        .send({
          title: 'Log Task',
          assigneeId: counselId,
          caseId: legalCase.id,
        })
        .expect(201);

      const task = taskRes.body.data;

      const timeline = await request(app.getHttpServer())
        .get('/api/v1/activity-logs')
        .query({ entityType: EntityType.TASK, entityId: task.id })
        .set(authHeader(counselToken))
        .expect(200);

      expect(timeline.body.data).toHaveLength(1);
      expect(timeline.body.data[0].action).toBe(AuditAction.CREATED);
    });

    it('TASK entity timeline shows STATUS_CHANGED after status update', async () => {
      const legalCase = await createCaseViaApi(counselToken);

      const taskRes = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set(authHeader(counselToken))
        .send({
          title: 'Status Task',
          assigneeId: counselId,
          caseId: legalCase.id,
        })
        .expect(201);

      const task = taskRes.body.data;

      await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${task.id}`)
        .set(authHeader(counselToken))
        .send({ status: TaskStatus.DONE })
        .expect(200);

      const timeline = await request(app.getHttpServer())
        .get('/api/v1/activity-logs')
        .query({ entityType: EntityType.TASK, entityId: task.id })
        .set(authHeader(counselToken))
        .expect(200);

      expect(timeline.body.data.length).toBeGreaterThanOrEqual(2);
      const actions = (timeline.body.data as { action: string }[]).map(
        (e) => e.action,
      );
      expect(actions).toContain(AuditAction.CREATED);
      expect(actions).toContain(AuditAction.STATUS_CHANGED);
    });

    it('DOCUMENT entity timeline shows DOCUMENT_UPLOADED after upload', async () => {
      const legalCase = await createCaseViaApi(counselToken);

      const uploadRes = await request(app.getHttpServer())
        .post('/api/v1/documents')
        .set(authHeader(counselToken))
        .field('documentType', DocumentType.EVIDENCE)
        .field('caseId', legalCase.id)
        .attach('file', Buffer.from('%PDF-1.4'), {
          filename: 'log.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      const doc = uploadRes.body.data;

      const timeline = await request(app.getHttpServer())
        .get('/api/v1/activity-logs')
        .query({ entityType: EntityType.DOCUMENT, entityId: doc.id })
        .set(authHeader(counselToken))
        .expect(200);

      expect(timeline.body.data).toHaveLength(1);
      expect(timeline.body.data[0].action).toBe(AuditAction.DOCUMENT_UPLOADED);
    });

    it('CONTRACT timeline shows CREATED log', async () => {
      const contract = await createContractViaApi(counselToken);

      const timeline = await request(app.getHttpServer())
        .get('/api/v1/activity-logs')
        .query({ entityType: EntityType.CONTRACT, entityId: contract.id })
        .set(authHeader(counselToken))
        .expect(200);

      expect(timeline.body.data.length).toBeGreaterThanOrEqual(1);
      expect(
        (timeline.body.data as { action: string }[]).some(
          (e) => e.action === AuditAction.CREATED,
        ),
      ).toBe(true);
    });

    it('NOTICE timeline shows CREATED log', async () => {
      const notice = await createNoticeViaApi(counselToken);

      const timeline = await request(app.getHttpServer())
        .get('/api/v1/activity-logs')
        .query({ entityType: EntityType.NOTICE, entityId: notice.id })
        .set(authHeader(counselToken))
        .expect(200);

      expect(timeline.body.data.length).toBeGreaterThanOrEqual(1);
      expect(
        (timeline.body.data as { action: string }[]).some(
          (e) => e.action === AuditAction.CREATED,
        ),
      ).toBe(true);
    });

    it('returns 404 when CASE entityId does not exist', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/activity-logs')
        .query({
          entityType: EntityType.CASE,
          entityId: '11111111-1111-4111-8111-111111111111',
        })
        .set(authHeader(counselToken))
        .expect(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Scoping behaviour
  // ──────────────────────────────────────────────────────────────────────────
  describe('Scoping behaviour', () => {
    it('unscoped counsel list only returns entries where counsel is the actor', async () => {
      const legalCase = await createCaseViaApi(counselToken);

      // Manager updates the case → creates a log with actorId = managerId
      await request(app.getHttpServer())
        .patch(`/api/v1/cases/${legalCase.id}`)
        .set(authHeader(managerToken))
        .send({ status: CaseStatus.IN_PROGRESS })
        .expect(200);

      // Counsel calls unscoped (no entityType/entityId) → only own actor logs
      const response = await request(app.getHttpServer())
        .get('/api/v1/activity-logs')
        .set(authHeader(counselToken))
        .expect(200);

      for (const entry of response.body.data as { actorId: string }[]) {
        expect(entry.actorId).toBe(counselId);
      }
    });

    it('unscoped admin list sees logs from all actors', async () => {
      const legalCase = await createCaseViaApi(counselToken);

      await request(app.getHttpServer())
        .patch(`/api/v1/cases/${legalCase.id}`)
        .set(authHeader(managerToken))
        .send({ status: CaseStatus.IN_PROGRESS })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/api/v1/activity-logs')
        .set(authHeader(adminToken))
        .expect(200);

      const actorIds = new Set(
        (response.body.data as { actorId: string }[]).map((e) => e.actorId),
      );
      // Both counsel (CREATED) and manager (STATUS_CHANGED) logs are visible
      expect(actorIds.size).toBeGreaterThanOrEqual(2);
    });

    it('viewer can read a scoped entity timeline', async () => {
      const legalCase = await createCaseViaApi(counselToken);

      await request(app.getHttpServer())
        .get('/api/v1/activity-logs')
        .query({ entityType: EntityType.CASE, entityId: legalCase.id })
        .set(authHeader(viewerToken))
        .expect(200);
    });

    it('unscoped viewer list has no actor-scope restriction and sees all logs', async () => {
      const legalCase = await createCaseViaApi(counselToken);

      await request(app.getHttpServer())
        .patch(`/api/v1/cases/${legalCase.id}`)
        .set(authHeader(managerToken))
        .send({ status: CaseStatus.IN_PROGRESS })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/api/v1/activity-logs')
        .set(authHeader(viewerToken))
        .expect(200);

      const actorIds = new Set(
        (response.body.data as { actorId: string }[]).map((e) => e.actorId),
      );
      expect(actorIds.size).toBeGreaterThanOrEqual(2);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Filters
  // ──────────────────────────────────────────────────────────────────────────
  describe('Filters', () => {
    it('filters by actorId — admin sees only the specified actor entries', async () => {
      const legalCase = await createCaseViaApi(counselToken);

      await request(app.getHttpServer())
        .patch(`/api/v1/cases/${legalCase.id}`)
        .set(authHeader(managerToken))
        .send({ status: CaseStatus.IN_PROGRESS })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/api/v1/activity-logs')
        .query({ actorId: counselId })
        .set(authHeader(adminToken))
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      for (const entry of response.body.data as { actorId: string }[]) {
        expect(entry.actorId).toBe(counselId);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Pagination
  // ──────────────────────────────────────────────────────────────────────────
  describe('Pagination', () => {
    it('returns correct page, limit, and total in meta', async () => {
      await createCaseViaApi(counselToken, { title: 'Case 1' });
      await createCaseViaApi(counselToken, { title: 'Case 2' });
      await createCaseViaApi(counselToken, { title: 'Case 3' });

      const response = await request(app.getHttpServer())
        .get('/api/v1/activity-logs')
        .query({ page: 1, limit: 2 })
        .set(authHeader(adminToken))
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(2);
      expect(response.body.meta.total).toBeGreaterThanOrEqual(3);
    });
  });
});
