import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  AuditAction,
  ContractStatus,
  ContractType,
  EntityType,
} from '@prisma/client';
import { authHeader, loginAs } from '../helpers/auth.helper';
import { createTestApp } from '../helpers/app.helper';
import {
  cleanupTestContracts,
  disconnectTestPrisma,
  getTestPrisma,
  getUserIdByEmail,
  seedTestUsers,
} from '../helpers/db.helper';

describe('Contracts (e2e)', () => {
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
    await cleanupTestContracts();
    await refreshAuthContext();
  });

  afterAll(async () => {
    await cleanupTestContracts();
    await app.close();
    await disconnectTestPrisma();
  });

  async function createContractViaApi(
    token: string,
    overrides: Record<string, unknown> = {},
  ) {
    const payload = {
      title: 'E2E MSA Contract',
      type: ContractType.MSA,
      counterpartyName: 'Acme Corp',
      effectiveDate: '2026-01-01',
      expirationDate: '2026-12-31',
      keyTerms: 'Net 30',
      ...overrides,
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/contracts')
      .set(authHeader(token))
      .send(payload)
      .expect(201);

    return response.body.data;
  }

  describe('RBAC and authentication', () => {
    it('returns 401 for unauthenticated list request', async () => {
      await request(app.getHttpServer()).get('/api/v1/contracts').expect(401);
    });

    it('returns 403 when viewer tries to create a contract', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/contracts')
        .set(authHeader(viewerToken))
        .send({
          title: 'Viewer Contract',
          type: ContractType.NDA,
          counterpartyName: 'Nobody',
        })
        .expect(403);
    });

    it('allows counsel to create a contract', async () => {
      const created = await createContractViaApi(counselToken);

      expect(created).toMatchObject({
        title: 'E2E MSA Contract',
        type: ContractType.MSA,
        status: ContractStatus.DRAFT,
        ownerId: counselId,
        counterpartyName: 'Acme Corp',
      });
      expect(created.referenceCode).toMatch(/^CTR-\d{4}-\d{5}$/);
    });

    it('returns 400 for invalid create payload', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/contracts')
        .set(authHeader(counselToken))
        .send({
          title: 'Missing counterparty',
          type: ContractType.NDA,
        })
        .expect(400);
    });

    it('returns 400 when expirationDate is before effectiveDate', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/contracts')
        .set(authHeader(counselToken))
        .send({
          title: 'Bad Dates',
          type: ContractType.LEASE,
          counterpartyName: 'Landlord',
          effectiveDate: '2026-06-01',
          expirationDate: '2026-01-01',
        })
        .expect(400);
    });
  });

  describe('Contract lifecycle', () => {
    it('create → get → update status → activity log entry exists', async () => {
      const created = await createContractViaApi(counselToken);

      const fetched = await request(app.getHttpServer())
        .get(`/api/v1/contracts/${created.id}`)
        .set(authHeader(counselToken))
        .expect(200);

      expect(fetched.body.data.id).toBe(created.id);
      expect(fetched.body.data.counterpartyName).toBe('Acme Corp');

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/contracts/${created.id}`)
        .set(authHeader(counselToken))
        .send({ status: ContractStatus.ACTIVE, title: 'Active MSA' })
        .expect(200);

      expect(updated.body.data.status).toBe(ContractStatus.ACTIVE);
      expect(updated.body.data.title).toBe('Active MSA');

      const logs = await getTestPrisma().activityLog.findMany({
        where: {
          entityType: EntityType.CONTRACT,
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

    it('soft deletes contract and hides it from list/get', async () => {
      const created = await createContractViaApi(counselToken);

      await request(app.getHttpServer())
        .delete(`/api/v1/contracts/${created.id}`)
        .set(authHeader(managerToken))
        .expect(200)
        .expect({ data: { success: true } });

      await request(app.getHttpServer())
        .get(`/api/v1/contracts/${created.id}`)
        .set(authHeader(adminToken))
        .expect(404);

      const list = await request(app.getHttpServer())
        .get('/api/v1/contracts')
        .set(authHeader(adminToken))
        .expect(200);

      expect(list.body.data).toHaveLength(0);
    });

    it('denies counsel from deleting even own contract', async () => {
      const created = await createContractViaApi(counselToken);

      await request(app.getHttpServer())
        .delete(`/api/v1/contracts/${created.id}`)
        .set(authHeader(counselToken))
        .expect(403);
    });
  });

  describe('Counsel isolation', () => {
    it('counsel1 cannot GET counsel2 contract', async () => {
      const created = await createContractViaApi(counsel2Token, {
        title: 'Counsel2 Private Contract',
      });

      await request(app.getHttpServer())
        .get(`/api/v1/contracts/${created.id}`)
        .set(authHeader(counselToken))
        .expect(403);
    });

    it('counsel list only returns own contracts', async () => {
      await createContractViaApi(counselToken, { title: 'Counsel1 Contract' });
      await createContractViaApi(counsel2Token, { title: 'Counsel2 Contract' });

      const counsel1List = await request(app.getHttpServer())
        .get('/api/v1/contracts')
        .set(authHeader(counselToken))
        .expect(200);

      expect(counsel1List.body.data).toHaveLength(1);
      expect(counsel1List.body.data[0].title).toBe('Counsel1 Contract');

      const adminList = await request(app.getHttpServer())
        .get('/api/v1/contracts')
        .set(authHeader(adminToken))
        .expect(200);

      expect(adminList.body.data).toHaveLength(2);
    });

    it('allows viewer to read all contracts but not mutate', async () => {
      const created = await createContractViaApi(counselToken);

      await request(app.getHttpServer())
        .get(`/api/v1/contracts/${created.id}`)
        .set(authHeader(viewerToken))
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/v1/contracts/${created.id}`)
        .set(authHeader(viewerToken))
        .send({ title: 'Viewer Edit' })
        .expect(403);
    });
  });

  describe('Reassign ownership', () => {
    it('manager reassigns contract and logs REASSIGNED', async () => {
      const created = await createContractViaApi(counselToken);

      const reassigned = await request(app.getHttpServer())
        .post(`/api/v1/contracts/${created.id}/reassign`)
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
      const created = await createContractViaApi(counselToken);

      await request(app.getHttpServer())
        .post(`/api/v1/contracts/${created.id}/reassign`)
        .set(authHeader(counselToken))
        .send({ ownerId: counsel2Id })
        .expect(403);
    });
  });

  describe('List filters and pagination', () => {
    beforeEach(async () => {
      await createContractViaApi(counselToken, {
        title: 'Active MSA',
        type: ContractType.MSA,
        status: ContractStatus.ACTIVE,
      });
      await createContractViaApi(counselToken, {
        title: 'Draft NDA',
        type: ContractType.NDA,
        status: ContractStatus.DRAFT,
      });
    });

    it('filters by status and type for admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/contracts')
        .query({
          status: ContractStatus.ACTIVE,
          type: ContractType.MSA,
        })
        .set(authHeader(adminToken))
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Active MSA');
    });

    it('supports pagination meta', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/contracts')
        .query({ page: 1, limit: 1 })
        .set(authHeader(adminToken))
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta).toEqual({
        page: 1,
        limit: 1,
        total: 2,
      });
    });

    it('allows manager to assign owner on create', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/contracts')
        .set(authHeader(managerToken))
        .send({
          title: 'Manager Assigned',
          type: ContractType.VENDOR,
          counterpartyName: 'Vendor Co',
          ownerId: counsel2Id,
        })
        .expect(201);

      expect(response.body.data.ownerId).toBe(counsel2Id);
    });

    it('rejects counsel assigning different owner', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/contracts')
        .set(authHeader(counselToken))
        .send({
          title: 'Bad Owner',
          type: ContractType.OTHER,
          counterpartyName: 'X',
          ownerId: counsel2Id,
        })
        .expect(400);
    });
  });
});
