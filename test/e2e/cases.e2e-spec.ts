import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  AuditAction,
  CaseStatus,
  CaseType,
  EntityType,
  PartyType,
  Priority,
} from '@prisma/client';
import { authHeader, loginAs } from '../helpers/auth.helper';
import { createTestApp } from '../helpers/app.helper';
import {
  cleanupTestCases,
  disconnectTestPrisma,
  getTestPrisma,
  getUserIdByEmail,
  seedTestUsers,
} from '../helpers/db.helper';

describe('Cases (e2e)', () => {
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

    const counselAuth = await loginAs(app, 'counsel@legal.local');
    counselToken = counselAuth.token;

    const counsel2Auth = await loginAs(app, 'counsel2@legal.local');
    counsel2Token = counsel2Auth.token;

    const managerAuth = await loginAs(app, 'manager@legal.local');
    managerToken = managerAuth.token;

    const adminAuth = await loginAs(app, 'admin@legal.local');
    adminToken = adminAuth.token;

    const viewerAuth = await loginAs(app, 'viewer@legal.local');
    viewerToken = viewerAuth.token;
  }

  beforeAll(async () => {
    await seedTestUsers();
    app = await createTestApp();
    await refreshAuthContext();
  });

  beforeEach(async () => {
    await cleanupTestCases();
    await refreshAuthContext();
  });

  afterAll(async () => {
    await cleanupTestCases();
    await app.close();
    await disconnectTestPrisma();
  });

  async function createCaseViaApi(
    token: string,
    overrides: Record<string, unknown> = {},
  ) {
    const payload = {
      title: 'E2E Test Case',
      type: CaseType.LITIGATION,
      priority: Priority.HIGH,
      description: 'Created during e2e tests',
      parties: [
        {
          name: 'Vendor X',
          partyType: PartyType.DEFENDANT,
          contactInfo: 'vendor@example.com',
        },
      ],
      ...overrides,
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/cases')
      .set(authHeader(token))
      .send(payload)
      .expect(201);

    return response.body.data;
  }

  describe('RBAC and authentication', () => {
    it('returns 401 for unauthenticated list request', async () => {
      await request(app.getHttpServer()).get('/api/v1/cases').expect(401);
    });

    it('returns 403 when viewer tries to create a case', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/cases')
        .set(authHeader(viewerToken))
        .send({
          title: 'Viewer Case',
          type: CaseType.OTHER,
          priority: Priority.LOW,
        })
        .expect(403);

      expect(response.body.message).toBe('Insufficient role permissions');
    });

    it('allows counsel to create a case', async () => {
      const created = await createCaseViaApi(counselToken);

      expect(created).toMatchObject({
        title: 'E2E Test Case',
        type: CaseType.LITIGATION,
        status: CaseStatus.OPEN,
        priority: Priority.HIGH,
        ownerId: counselId,
      });
      expect(created.referenceCode).toMatch(/^CASE-\d{4}-\d{5}$/);
      expect(created.parties).toHaveLength(1);
    });

    it('returns 400 for invalid create payload', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cases')
        .set(authHeader(counselToken))
        .send({
          title: 'Missing type',
          priority: Priority.LOW,
        })
        .expect(400);
    });

    it('returns 400 for unexpected fields on create', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cases')
        .set(authHeader(counselToken))
        .send({
          title: 'Bad Field',
          type: CaseType.OTHER,
          priority: Priority.LOW,
          hacker: true,
        })
        .expect(400);
    });
  });

  describe('Case lifecycle', () => {
    it('create → get → update status → activity log entry exists', async () => {
      const created = await createCaseViaApi(counselToken);

      const fetched = await request(app.getHttpServer())
        .get(`/api/v1/cases/${created.id}`)
        .set(authHeader(counselToken))
        .expect(200);

      expect(fetched.body.data.id).toBe(created.id);
      expect(fetched.body.data.parties).toHaveLength(1);

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/cases/${created.id}`)
        .set(authHeader(counselToken))
        .send({ status: CaseStatus.IN_PROGRESS, priority: Priority.CRITICAL })
        .expect(200);

      expect(updated.body.data.status).toBe(CaseStatus.IN_PROGRESS);
      expect(updated.body.data.priority).toBe(Priority.CRITICAL);

      const logs = await getTestPrisma().activityLog.findMany({
        where: {
          entityType: EntityType.CASE,
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

      const statusLog = logs.find(
        (log) => log.action === AuditAction.STATUS_CHANGED,
      );
      expect(statusLog?.metadata).toMatchObject({
        from: CaseStatus.OPEN,
        to: CaseStatus.IN_PROGRESS,
      });
    });

    it('soft deletes case and hides it from list/get', async () => {
      const created = await createCaseViaApi(counselToken);

      await request(app.getHttpServer())
        .delete(`/api/v1/cases/${created.id}`)
        .set(authHeader(managerToken))
        .expect(200)
        .expect({ data: { success: true } });

      await request(app.getHttpServer())
        .get(`/api/v1/cases/${created.id}`)
        .set(authHeader(adminToken))
        .expect(404);

      const list = await request(app.getHttpServer())
        .get('/api/v1/cases')
        .set(authHeader(adminToken))
        .expect(200);

      expect(list.body.data).toHaveLength(0);

      const deleteLog = await getTestPrisma().activityLog.findFirst({
        where: {
          entityId: created.id,
          action: AuditAction.DELETED,
        },
      });
      expect(deleteLog).not.toBeNull();
    });

    it('returns 404 when deleting already deleted case', async () => {
      const created = await createCaseViaApi(counselToken);

      await request(app.getHttpServer())
        .delete(`/api/v1/cases/${created.id}`)
        .set(authHeader(adminToken))
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/api/v1/cases/${created.id}`)
        .set(authHeader(adminToken))
        .expect(404);
    });

    it('denies counsel from deleting even own case', async () => {
      const created = await createCaseViaApi(counselToken);

      await request(app.getHttpServer())
        .delete(`/api/v1/cases/${created.id}`)
        .set(authHeader(counselToken))
        .expect(403);
    });
  });

  describe('Counsel isolation', () => {
    it('counsel1 cannot GET counsel2 case', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/cases')
        .set(authHeader(counsel2Token))
        .send({
          title: 'Counsel2 Private Case',
          type: CaseType.INTERNAL,
          priority: Priority.LOW,
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/cases/${created.body.data.id}`)
        .set(authHeader(counselToken))
        .expect(403);

      expect(response.body.message).toBe(
        'You do not have access to this resource',
      );
    });

    it('counsel list only returns own cases', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cases')
        .set(authHeader(counselToken))
        .send({
          title: 'Counsel1 Case',
          type: CaseType.LITIGATION,
          priority: Priority.HIGH,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/cases')
        .set(authHeader(counsel2Token))
        .send({
          title: 'Counsel2 Case',
          type: CaseType.REGULATORY,
          priority: Priority.MEDIUM,
        })
        .expect(201);

      const counsel1List = await request(app.getHttpServer())
        .get('/api/v1/cases')
        .set(authHeader(counselToken))
        .expect(200);

      expect(counsel1List.body.data).toHaveLength(1);
      expect(counsel1List.body.data[0].title).toBe('Counsel1 Case');

      const adminList = await request(app.getHttpServer())
        .get('/api/v1/cases')
        .set(authHeader(adminToken))
        .expect(200);

      expect(adminList.body.data).toHaveLength(2);
    });

    it('denies counsel from updating another counsels case', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/cases')
        .set(authHeader(counsel2Token))
        .send({
          title: 'Protected Case',
          type: CaseType.ARBITRATION,
          priority: Priority.HIGH,
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/cases/${created.body.data.id}`)
        .set(authHeader(counselToken))
        .send({ title: 'Hijacked' })
        .expect(403);
    });

    it('allows viewer to read all cases but not mutate', async () => {
      const created = await createCaseViaApi(counselToken);

      await request(app.getHttpServer())
        .get(`/api/v1/cases/${created.id}`)
        .set(authHeader(viewerToken))
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/v1/cases/${created.id}`)
        .set(authHeader(viewerToken))
        .send({ title: 'Viewer Edit' })
        .expect(403);
    });
  });

  describe('Reassign ownership', () => {
    it('manager reassigns case and logs REASSIGNED', async () => {
      const created = await createCaseViaApi(counselToken);

      const reassigned = await request(app.getHttpServer())
        .post(`/api/v1/cases/${created.id}/reassign`)
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

      await request(app.getHttpServer())
        .get(`/api/v1/cases/${created.id}`)
        .set(authHeader(counselToken))
        .expect(403);

      await request(app.getHttpServer())
        .get(`/api/v1/cases/${created.id}`)
        .set(authHeader(counsel2Token))
        .expect(200);
    });

    it('denies counsel from reassigning', async () => {
      const created = await createCaseViaApi(counselToken);

      await request(app.getHttpServer())
        .post(`/api/v1/cases/${created.id}/reassign`)
        .set(authHeader(counselToken))
        .send({ ownerId: counsel2Id })
        .expect(403);
    });

    it('returns 404 when reassigning to invalid owner', async () => {
      const created = await createCaseViaApi(counselToken);

      await request(app.getHttpServer())
        .post(`/api/v1/cases/${created.id}/reassign`)
        .set(authHeader(managerToken))
        .send({ ownerId: '00000000-0000-0000-0000-000000000000' })
        .expect(404);
    });
  });

  describe('Parties', () => {
    it('lists and adds parties with activity log', async () => {
      const created = await createCaseViaApi(counselToken, { parties: [] });

      const listed = await request(app.getHttpServer())
        .get(`/api/v1/cases/${created.id}/parties`)
        .set(authHeader(counselToken))
        .expect(200);

      expect(listed.body.data).toHaveLength(0);

      const added = await request(app.getHttpServer())
        .post(`/api/v1/cases/${created.id}/parties`)
        .set(authHeader(counselToken))
        .send({
          name: 'New Plaintiff',
          partyType: PartyType.PLAINTIFF,
          contactInfo: 'p@example.com',
        })
        .expect(201);

      expect(added.body.data.name).toBe('New Plaintiff');

      const listedAfter = await request(app.getHttpServer())
        .get(`/api/v1/cases/${created.id}/parties`)
        .set(authHeader(adminToken))
        .expect(200);

      expect(listedAfter.body.data).toHaveLength(1);

      const partyLog = await getTestPrisma().activityLog.findFirst({
        where: {
          entityId: created.id,
          action: AuditAction.UPDATED,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(partyLog?.metadata).toMatchObject({
        partyAdded: expect.objectContaining({
          name: 'New Plaintiff',
          partyType: PartyType.PLAINTIFF,
        }),
      });
    });

    it('denies unauthorized counsel from listing parties', async () => {
      const created = await createCaseViaApi(counsel2Token, { parties: [] });

      await request(app.getHttpServer())
        .get(`/api/v1/cases/${created.id}/parties`)
        .set(authHeader(counselToken))
        .expect(403);
    });
  });

  describe('List filters and pagination', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cases')
        .set(authHeader(counselToken))
        .send({
          title: 'Open Litigation',
          type: CaseType.LITIGATION,
          status: CaseStatus.OPEN,
          priority: Priority.HIGH,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/cases')
        .set(authHeader(counselToken))
        .send({
          title: 'Closed Internal',
          type: CaseType.INTERNAL,
          status: CaseStatus.CLOSED,
          priority: Priority.LOW,
        })
        .expect(201);
    });

    it('filters by status and type for admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/cases')
        .query({
          status: CaseStatus.OPEN,
          type: CaseType.LITIGATION,
        })
        .set(authHeader(adminToken))
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Open Litigation');
      expect(response.body.meta.total).toBe(1);
    });

    it('supports pagination meta', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/cases')
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
        .post('/api/v1/cases')
        .set(authHeader(managerToken))
        .send({
          title: 'Manager Assigned',
          type: CaseType.REGULATORY,
          priority: Priority.MEDIUM,
          ownerId: counsel2Id,
        })
        .expect(201);

      expect(response.body.data.ownerId).toBe(counsel2Id);
    });

    it('rejects counsel assigning different owner', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cases')
        .set(authHeader(counselToken))
        .send({
          title: 'Bad Owner',
          type: CaseType.OTHER,
          priority: Priority.LOW,
          ownerId: counsel2Id,
        })
        .expect(400);
    });
  });

  describe('Validation edge cases', () => {
    it('returns 400 for invalid UUID in path', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/cases/not-a-uuid')
        .set(authHeader(adminToken))
        .expect(400);
    });

    it('returns 404 for non-existent case', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/cases/00000000-0000-0000-0000-000000000001')
        .set(authHeader(adminToken))
        .expect(404);
    });
  });
});
