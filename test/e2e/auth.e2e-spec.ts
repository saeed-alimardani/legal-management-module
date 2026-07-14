import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { createTestApp } from '../helpers/app.helper';
import {
  deleteUserByEmail,
  disconnectTestPrisma,
  getTestPrisma,
  seedTestUsers,
  TEST_PASSWORD,
  upsertInactiveUser,
} from '../helpers/db.helper';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await seedTestUsers();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await deleteUserByEmail('inactive@legal.local');
    await deleteUserByEmail('inactive-e2e@legal.local');
    await disconnectTestPrisma();
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns JWT and user profile for valid admin credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@legal.local', password: TEST_PASSWORD })
        .expect(200);

      expect(response.body.data.accessToken).toEqual(expect.any(String));
      expect(response.body.data.user).toEqual({
        id: expect.any(String),
        email: 'admin@legal.local',
        fullName: 'Legal Admin',
        role: UserRole.LEGAL_ADMIN,
      });
      expect(response.body.data.user).not.toHaveProperty('passwordHash');
    });

    it.each([
      ['counsel@legal.local', UserRole.LEGAL_COUNSEL],
      ['manager@legal.local', UserRole.LEGAL_MANAGER],
      ['viewer@legal.local', UserRole.VIEWER],
    ])('authenticates %s with correct role', async (email, role) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: TEST_PASSWORD })
        .expect(200);

      expect(response.body.data.user.role).toBe(role);
      expect(response.body.data.accessToken.length).toBeGreaterThan(20);
    });

    it('returns 401 for invalid password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'counsel@legal.local', password: 'WrongPassword!' })
        .expect(401);

      expect(response.body.message).toBe('Invalid email or password');
    });

    it('returns 401 for unknown email', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'unknown@legal.local', password: TEST_PASSWORD })
        .expect(401);
    });

    it('returns 401 for inactive user', async () => {
      await upsertInactiveUser('inactive@legal.local');

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'inactive@legal.local', password: TEST_PASSWORD })
        .expect(401);

      expect(response.body.message).toBe('User account is inactive');
    });

    it('returns 400 for invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: TEST_PASSWORD })
        .expect(400);
    });

    it('returns 400 when password is too short', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@legal.local', password: 'short' })
        .expect(400);
    });

    it('returns 400 for unexpected fields (whitelist)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@legal.local',
          password: TEST_PASSWORD,
          hacker: true,
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns current user when JWT is valid', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'counsel@legal.local', password: TEST_PASSWORD })
        .expect(200);

      const token = login.body.data.accessToken;

      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toEqual({
        id: login.body.data.user.id,
        email: 'counsel@legal.local',
        fullName: 'Legal Counsel',
        role: UserRole.LEGAL_COUNSEL,
      });
    });

    it('returns 401 without authorization header', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('returns 401 for malformed token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer not-a-valid-jwt')
        .expect(401);
    });

    it('returns 401 when user becomes inactive after token was issued', async () => {
      const email = 'inactive-e2e@legal.local';
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const prisma = getTestPrisma();

      const created = await prisma.user.upsert({
        where: { email },
        update: {
          fullName: 'Temp Active',
          role: UserRole.VIEWER,
          passwordHash,
          isActive: true,
        },
        create: {
          email,
          fullName: 'Temp Active',
          role: UserRole.VIEWER,
          passwordHash,
          isActive: true,
        },
      });

      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: TEST_PASSWORD })
        .expect(200);

      await prisma.user.update({
        where: { id: created.id },
        data: { isActive: false },
      });

      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${login.body.data.accessToken}`)
        .expect(401);
    });

    it('returns 401 when user id in token no longer exists', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'counsel2@legal.local', password: TEST_PASSWORD })
        .expect(200);

      const token = login.body.data.accessToken;
      const userId = login.body.data.user.id;

      await getTestPrisma().user.delete({ where: { id: userId } });

      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      await seedTestUsers();
    });
  });

  describe('Health remains public', () => {
    it('GET /health does not require auth', async () => {
      await request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect({ data: { status: 'ok' } });
    });
  });
});
