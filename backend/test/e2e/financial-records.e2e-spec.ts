import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  AuditAction,
  CaseStatus,
  CaseType,
  EntityType,
  FinancialRecordType,
  Priority,
} from '@prisma/client';
import { authHeader, loginAs } from '../helpers/auth.helper';
import { createTestApp } from '../helpers/app.helper';
import {
  cleanupTestCases,
  cleanupTestContracts,
  cleanupTestFinancialRecords,
  disconnectTestPrisma,
  getTestPrisma,
  getUserIdByEmail,
  seedTestUsers,
} from '../helpers/db.helper';

describe('Financial Records (e2e)', () => {
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
    await cleanupTestFinancialRecords();
    await cleanupTestCases();
    await cleanupTestContracts();
    await refreshAuthContext();
  });

  afterAll(async () => {
    await cleanupTestFinancialRecords();
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
        title: 'Financial Parent Case',
        type: CaseType.LITIGATION,
        status: CaseStatus.OPEN,
        priority: Priority.MEDIUM,
        ...overrides,
      })
      .expect(201);
    return res.body.data;
  }

  async function createFinancialRecordViaApi(
    token: string,
    overrides: Record<string, unknown> = {},
  ) {
    const legalCase =
      overrides.caseId !== undefined
        ? { id: overrides.caseId }
        : await createCaseViaApi(token);

    const res = await request(app.getHttpServer())
      .post('/api/v1/financial-records')
      .set(authHeader(token))
      .send({
        title: 'Court filing fee',
        amount: 1500000.5,
        currency: 'IRR',
        type: FinancialRecordType.EXPENSE,
        recordDate: '2026-07-14',
        description: 'E2E financial record',
        caseId: legalCase.id,
        ...overrides,
      })
      .expect(201);

    return res.body.data;
  }

  describe('Auth and RBAC', () => {
    it('returns 401 for unauthenticated list request', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/financial-records')
        .expect(401);
    });

    it('returns 403 when viewer tries to create a financial record', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      await request(app.getHttpServer())
        .post('/api/v1/financial-records')
        .set(authHeader(viewerToken))
        .send({
          title: 'Viewer Record',
          amount: 100,
          type: FinancialRecordType.EXPENSE,
          recordDate: '2026-07-14',
          caseId: legalCase.id,
        })
        .expect(403);
    });

    it('allows counsel to create a financial record on own case', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const created = await createFinancialRecordViaApi(counselToken, {
        caseId: legalCase.id,
      });

      expect(created.title).toBe('Court filing fee');
      expect(created.type).toBe(FinancialRecordType.EXPENSE);
      expect(created.caseId).toBe(legalCase.id);
      expect(created.createdById).toBe(counselId);
    });

    it('allows manager to create on counsel case', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const created = await createFinancialRecordViaApi(managerToken, {
        caseId: legalCase.id,
        title: 'Manager expense',
      });

      expect(created.title).toBe('Manager expense');
    });
  });

  describe('Validation', () => {
    it('returns 400 when no parent is provided', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/financial-records')
        .set(authHeader(counselToken))
        .send({
          title: 'No Parent',
          amount: 100,
          type: FinancialRecordType.EXPENSE,
          recordDate: '2026-07-14',
        })
        .expect(400);
    });

    it('returns 400 for negative amount', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      await request(app.getHttpServer())
        .post('/api/v1/financial-records')
        .set(authHeader(counselToken))
        .send({
          title: 'Bad Amount',
          amount: -1,
          type: FinancialRecordType.EXPENSE,
          recordDate: '2026-07-14',
          caseId: legalCase.id,
        })
        .expect(400);
    });

    it('returns 404 for missing parent case', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/financial-records')
        .set(authHeader(counselToken))
        .send({
          title: 'Missing Case',
          amount: 100,
          type: FinancialRecordType.EXPENSE,
          recordDate: '2026-07-14',
          caseId: '11111111-1111-4111-8111-111111111111',
        })
        .expect(404);
    });

    it('returns 400 for invalid UUID in GET path', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/financial-records/not-a-uuid')
        .set(authHeader(counselToken))
        .expect(400);
    });
  });

  describe('Financial record lifecycle on case', () => {
    it('create → list by caseId → get → patch → delete → hidden from get', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const created = await createFinancialRecordViaApi(counselToken, {
        caseId: legalCase.id,
      });

      const list = await request(app.getHttpServer())
        .get('/api/v1/financial-records')
        .query({ caseId: legalCase.id })
        .set(authHeader(counselToken))
        .expect(200);
      expect(list.body.data).toHaveLength(1);

      const fetched = await request(app.getHttpServer())
        .get(`/api/v1/financial-records/${created.id}`)
        .set(authHeader(counselToken))
        .expect(200);
      expect(fetched.body.data.amount).toBe('1500000.50');

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/financial-records/${created.id}`)
        .set(authHeader(counselToken))
        .send({
          title: 'Updated fee',
          amount: 2000000,
          type: FinancialRecordType.INVOICE,
        })
        .expect(200);
      expect(updated.body.data.title).toBe('Updated fee');
      expect(updated.body.data.type).toBe(FinancialRecordType.INVOICE);

      await request(app.getHttpServer())
        .delete(`/api/v1/financial-records/${created.id}`)
        .set(authHeader(counselToken))
        .expect(200)
        .expect({ data: { success: true } });

      await request(app.getHttpServer())
        .get(`/api/v1/financial-records/${created.id}`)
        .set(authHeader(adminToken))
        .expect(404);

      const dbRecord = await getTestPrisma().financialRecord.findUnique({
        where: { id: created.id },
      });
      expect(dbRecord?.deletedAt).not.toBeNull();
    });

    it('generates CREATED, UPDATED, and DELETED activity logs', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const created = await createFinancialRecordViaApi(counselToken, {
        caseId: legalCase.id,
      });

      await request(app.getHttpServer())
        .patch(`/api/v1/financial-records/${created.id}`)
        .set(authHeader(counselToken))
        .send({ title: 'Logged update' })
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/api/v1/financial-records/${created.id}`)
        .set(authHeader(counselToken))
        .expect(200);

      const logs = await getTestPrisma().activityLog.findMany({
        where: {
          entityType: EntityType.FINANCIAL_RECORD,
          entityId: created.id,
        },
        orderBy: { createdAt: 'asc' },
      });

      expect(logs.map((log) => log.action)).toEqual(
        expect.arrayContaining([
          AuditAction.CREATED,
          AuditAction.UPDATED,
          AuditAction.DELETED,
        ]),
      );
    });
  });

  describe('Counsel isolation', () => {
    it('counsel2 cannot GET financial record on counsel case', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const created = await createFinancialRecordViaApi(counselToken, {
        caseId: legalCase.id,
      });

      await request(app.getHttpServer())
        .get(`/api/v1/financial-records/${created.id}`)
        .set(authHeader(counsel2Token))
        .expect(403);
    });

    it('counsel list scoped to own cases', async () => {
      const case1 = await createCaseViaApi(counselToken);
      const case2 = await createCaseViaApi(counsel2Token);

      await createFinancialRecordViaApi(counselToken, {
        caseId: case1.id,
        title: 'Counsel1 expense',
      });
      await createFinancialRecordViaApi(counsel2Token, {
        caseId: case2.id,
        title: 'Counsel2 expense',
      });

      const counselList = await request(app.getHttpServer())
        .get('/api/v1/financial-records')
        .set(authHeader(counselToken))
        .expect(200);

      expect(counselList.body.data).toHaveLength(1);
      expect(counselList.body.data[0].title).toBe('Counsel1 expense');
    });

    it('viewer can read but not mutate', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const created = await createFinancialRecordViaApi(counselToken, {
        caseId: legalCase.id,
      });

      await request(app.getHttpServer())
        .get(`/api/v1/financial-records/${created.id}`)
        .set(authHeader(viewerToken))
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/v1/financial-records/${created.id}`)
        .set(authHeader(viewerToken))
        .send({ title: 'Viewer edit' })
        .expect(403);
    });
  });
});
