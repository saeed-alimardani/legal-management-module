import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  AuditAction,
  CaseStatus,
  CaseType,
  EntityType,
  Priority,
} from '@prisma/client';
import { authHeader, loginAs } from '../helpers/auth.helper';
import { createTestApp } from '../helpers/app.helper';
import {
  cleanupTestCases,
  cleanupTestContracts,
  cleanupTestDiscussions,
  disconnectTestPrisma,
  getTestPrisma,
  getUserIdByEmail,
  seedTestUsers,
} from '../helpers/db.helper';

describe('Discussions (e2e)', () => {
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
    await cleanupTestDiscussions();
    await cleanupTestCases();
    await cleanupTestContracts();
    await refreshAuthContext();
  });

  afterAll(async () => {
    await cleanupTestDiscussions();
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
        title: 'Discussion Parent Case',
        type: CaseType.LITIGATION,
        status: CaseStatus.OPEN,
        priority: Priority.MEDIUM,
        ...overrides,
      })
      .expect(201);
    return res.body.data;
  }

  async function createDiscussionViaApi(
    token: string,
    overrides: Record<string, unknown> = {},
  ) {
    const legalCase =
      overrides.caseId !== undefined
        ? { id: overrides.caseId }
        : await createCaseViaApi(token);

    const res = await request(app.getHttpServer())
      .post('/api/v1/discussions')
      .set(authHeader(token))
      .send({
        content: 'E2E discussion note on the case.',
        caseId: legalCase.id,
        ...overrides,
      })
      .expect(201);

    return res.body.data;
  }

  describe('Auth and RBAC', () => {
    it('returns 401 for unauthenticated list request', async () => {
      await request(app.getHttpServer()).get('/api/v1/discussions').expect(401);
    });

    it('returns 403 when viewer tries to create a discussion', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      await request(app.getHttpServer())
        .post('/api/v1/discussions')
        .set(authHeader(viewerToken))
        .send({
          content: 'Viewer discussion',
          caseId: legalCase.id,
        })
        .expect(403);
    });

    it('allows counsel to create a discussion on own case', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const created = await createDiscussionViaApi(counselToken, {
        caseId: legalCase.id,
        content: 'Please review the filing.',
      });

      expect(created.content).toBe('Please review the filing.');
      expect(created.authorId).toBe(counselId);
      expect(created.caseId).toBe(legalCase.id);
    });

    it('allows manager to create a discussion on counsel case', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const created = await createDiscussionViaApi(managerToken, {
        caseId: legalCase.id,
      });

      expect(created.caseId).toBe(legalCase.id);
    });
  });

  describe('Validation', () => {
    it('returns 400 when no parent is provided', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/discussions')
        .set(authHeader(counselToken))
        .send({ content: 'No parent' })
        .expect(400);
    });

    it('returns 400 when content is empty', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      await request(app.getHttpServer())
        .post('/api/v1/discussions')
        .set(authHeader(counselToken))
        .send({ content: '', caseId: legalCase.id })
        .expect(400);
    });

    it('returns 404 for missing parent case', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/discussions')
        .set(authHeader(counselToken))
        .send({
          content: 'Missing case',
          caseId: '11111111-1111-4111-8111-111111111111',
        })
        .expect(404);
    });

    it('returns 400 for invalid UUID in GET path', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/discussions/not-a-uuid')
        .set(authHeader(counselToken))
        .expect(400);
    });
  });

  describe('Discussion lifecycle on case', () => {
    it('create → list by caseId → get → patch → delete → hidden from get', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const created = await createDiscussionViaApi(counselToken, {
        caseId: legalCase.id,
      });

      const list = await request(app.getHttpServer())
        .get('/api/v1/discussions')
        .query({ caseId: legalCase.id })
        .set(authHeader(counselToken))
        .expect(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].id).toBe(created.id);

      const fetched = await request(app.getHttpServer())
        .get(`/api/v1/discussions/${created.id}`)
        .set(authHeader(counselToken))
        .expect(200);
      expect(fetched.body.data.content).toBe(created.content);

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/discussions/${created.id}`)
        .set(authHeader(counselToken))
        .send({ content: 'Updated discussion content' })
        .expect(200);
      expect(updated.body.data.content).toBe('Updated discussion content');

      await request(app.getHttpServer())
        .delete(`/api/v1/discussions/${created.id}`)
        .set(authHeader(counselToken))
        .expect(200)
        .expect({ data: { success: true } });

      await request(app.getHttpServer())
        .get(`/api/v1/discussions/${created.id}`)
        .set(authHeader(adminToken))
        .expect(404);

      const dbDiscussion = await getTestPrisma().discussion.findUnique({
        where: { id: created.id },
      });
      expect(dbDiscussion?.deletedAt).not.toBeNull();
    });

    it('generates CREATED, UPDATED, and DELETED activity logs', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const created = await createDiscussionViaApi(counselToken, {
        caseId: legalCase.id,
      });

      await request(app.getHttpServer())
        .patch(`/api/v1/discussions/${created.id}`)
        .set(authHeader(counselToken))
        .send({ content: 'Edited' })
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/api/v1/discussions/${created.id}`)
        .set(authHeader(counselToken))
        .expect(200);

      const logs = await getTestPrisma().activityLog.findMany({
        where: { entityType: EntityType.DISCUSSION, entityId: created.id },
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
    it('counsel2 cannot GET discussion on counsel case', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const created = await createDiscussionViaApi(counselToken, {
        caseId: legalCase.id,
      });

      await request(app.getHttpServer())
        .get(`/api/v1/discussions/${created.id}`)
        .set(authHeader(counsel2Token))
        .expect(403);
    });

    it('counsel2 cannot PATCH discussion authored by counsel', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const created = await createDiscussionViaApi(counselToken, {
        caseId: legalCase.id,
      });

      await request(app.getHttpServer())
        .patch(`/api/v1/discussions/${created.id}`)
        .set(authHeader(counsel2Token))
        .send({ content: 'Hijacked' })
        .expect(403);
    });

    it('counsel list scoped to own cases', async () => {
      const case1 = await createCaseViaApi(counselToken);
      const case2 = await createCaseViaApi(counsel2Token);

      await createDiscussionViaApi(counselToken, {
        caseId: case1.id,
        content: 'Counsel1 note',
      });
      await createDiscussionViaApi(counsel2Token, {
        caseId: case2.id,
        content: 'Counsel2 note',
      });

      const counselList = await request(app.getHttpServer())
        .get('/api/v1/discussions')
        .set(authHeader(counselToken))
        .expect(200);

      expect(counselList.body.data).toHaveLength(1);
      expect(counselList.body.data[0].content).toBe('Counsel1 note');
    });

    it('viewer can read but not mutate', async () => {
      const legalCase = await createCaseViaApi(counselToken);
      const created = await createDiscussionViaApi(counselToken, {
        caseId: legalCase.id,
      });

      await request(app.getHttpServer())
        .get(`/api/v1/discussions/${created.id}`)
        .set(authHeader(viewerToken))
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/api/v1/discussions/${created.id}`)
        .set(authHeader(viewerToken))
        .expect(403);
    });
  });
});
