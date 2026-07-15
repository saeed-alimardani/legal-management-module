import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuditAction, EntityType, UserRole } from '@prisma/client';
import { authHeader, loginAs } from '../helpers/auth.helper';
import { createTestApp } from '../helpers/app.helper';
import {
  cleanupTestUsers,
  disconnectTestPrisma,
  getTestPrisma,
  seedTestUsers,
  TEST_PASSWORD,
} from '../helpers/db.helper';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let counselToken: string;
  let managerToken: string;
  let adminToken: string;
  let viewerToken: string;
  const createdEmails: string[] = [];

  async function refreshAuthContext(): Promise<void> {
    await seedTestUsers();
    counselToken = (await loginAs(app, 'counsel@legal.local')).token;
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
    await cleanupTestUsers(createdEmails);
    createdEmails.length = 0;
    await refreshAuthContext();
  });

  afterAll(async () => {
    await cleanupTestUsers(createdEmails);
    await app.close();
    await disconnectTestPrisma();
  });

  async function createUserViaApi(
    token: string,
    overrides: Record<string, unknown> = {},
  ) {
    const email = (overrides.email as string) ?? `user-${Date.now()}@legal.local`;
    createdEmails.push(email);

    const res = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set(authHeader(token))
      .send({
        email,
        password: TEST_PASSWORD,
        fullName: 'E2E New User',
        role: UserRole.LEGAL_COUNSEL,
        ...overrides,
      })
      .expect(201);

    return res.body.data;
  }

  describe('Auth and RBAC', () => {
    it('returns 401 for unauthenticated list request', async () => {
      await request(app.getHttpServer()).get('/api/v1/users').expect(401);
    });

    it('returns 403 when counsel tries to list users', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users')
        .set(authHeader(counselToken))
        .expect(403);
    });

    it('returns 403 when viewer tries to list users', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users')
        .set(authHeader(viewerToken))
        .expect(403);
    });

    it('allows admin to list users', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(5);
      expect(res.body.meta).toEqual(
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });

    it('allows manager to create a user', async () => {
      const created = await createUserViaApi(managerToken, {
        fullName: 'Manager Created User',
      });

      expect(created.fullName).toBe('Manager Created User');
      expect(created.role).toBe(UserRole.LEGAL_COUNSEL);
      expect(created.isActive).toBe(true);
      expect(created).not.toHaveProperty('passwordHash');
    });

    it('returns 403 when counsel tries to create a user', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set(authHeader(counselToken))
        .send({
          email: 'forbidden@legal.local',
          password: TEST_PASSWORD,
          fullName: 'Forbidden User',
          role: UserRole.VIEWER,
        })
        .expect(403);
    });
  });

  describe('Validation', () => {
    it('returns 400 for invalid email', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({
          email: 'not-an-email',
          password: TEST_PASSWORD,
          fullName: 'Bad Email',
          role: UserRole.VIEWER,
        })
        .expect(400);
    });

    it('returns 400 when password is too short', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({
          email: 'shortpw@legal.local',
          password: 'short',
          fullName: 'Short Password',
          role: UserRole.VIEWER,
        })
        .expect(400);
    });

    it('returns 409 for duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set(authHeader(adminToken))
        .send({
          email: 'counsel@legal.local',
          password: TEST_PASSWORD,
          fullName: 'Duplicate Email',
          role: UserRole.LEGAL_COUNSEL,
        })
        .expect(409);
    });

    it('returns 400 for invalid UUID in GET path', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users/not-a-uuid')
        .set(authHeader(adminToken))
        .expect(400);
    });
  });

  describe('User lifecycle', () => {
    it('create → get → patch fullName and isActive → activity log exists', async () => {
      const created = await createUserViaApi(adminToken, {
        fullName: 'Lifecycle User',
      });

      const fetched = await request(app.getHttpServer())
        .get(`/api/v1/users/${created.id}`)
        .set(authHeader(adminToken))
        .expect(200);
      expect(fetched.body.data.id).toBe(created.id);

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/users/${created.id}`)
        .set(authHeader(managerToken))
        .send({ fullName: 'Updated Name', isActive: false })
        .expect(200);

      expect(updated.body.data.fullName).toBe('Updated Name');
      expect(updated.body.data.isActive).toBe(false);

      const logs = await getTestPrisma().activityLog.findMany({
        where: { entityType: EntityType.USER, entityId: created.id },
        orderBy: { createdAt: 'asc' },
      });

      expect(logs.map((log) => log.action)).toEqual(
        expect.arrayContaining([AuditAction.CREATED, AuditAction.UPDATED]),
      );
    });

    it('returns 404 for non-existent user', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users/00000000-0000-0000-0000-000000000001')
        .set(authHeader(adminToken))
        .expect(404);
    });
  });

  describe('List filters', () => {
    it('filters by role and isActive for admin', async () => {
      await createUserViaApi(adminToken, {
        email: 'inactive-test@legal.local',
        role: UserRole.VIEWER,
      });
      const inactiveId = (
        await request(app.getHttpServer())
          .get('/api/v1/users')
          .query({ role: UserRole.VIEWER })
          .set(authHeader(adminToken))
          .expect(200)
      ).body.data.find(
        (u: { email: string }) => u.email === 'inactive-test@legal.local',
      ).id;

      await request(app.getHttpServer())
        .patch(`/api/v1/users/${inactiveId}`)
        .set(authHeader(adminToken))
        .send({ isActive: false })
        .expect(200);

      const activeViewers = await request(app.getHttpServer())
        .get('/api/v1/users')
        .query({ role: UserRole.VIEWER, isActive: true })
        .set(authHeader(adminToken))
        .expect(200);

      expect(
        activeViewers.body.data.every(
          (u: { isActive: boolean }) => u.isActive === true,
        ),
      ).toBe(true);
      expect(
        activeViewers.body.data.some(
          (u: { email: string }) => u.email === 'inactive-test@legal.local',
        ),
      ).toBe(false);
    });
  });
});
