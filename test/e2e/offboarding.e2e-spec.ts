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
  disconnectTestPrisma,
  getTestPrisma,
  getUserIdByEmail,
  seedTestUsers,
} from '../helpers/db.helper';

describe('Offboarding (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let counselToken: string;
  let counselId: string;
  let counsel2Id: string;

  beforeAll(async () => {
    await seedTestUsers();
    app = await createTestApp();
  });

  beforeEach(async () => {
    await cleanupTestCases();
    await seedTestUsers();
    counselId = await getUserIdByEmail('counsel@legal.local');
    counsel2Id = await getUserIdByEmail('counsel2@legal.local');
    adminToken = (await loginAs(app, 'admin@legal.local')).token;
    counselToken = (await loginAs(app, 'counsel@legal.local')).token;
  });

  afterAll(async () => {
    await cleanupTestCases();
    await app.close();
    await disconnectTestPrisma();
  });

  async function createCounselCase(referenceCode: string, title: string) {
    const prisma = getTestPrisma();
    return prisma.legalCase.create({
      data: {
        referenceCode,
        title,
        type: CaseType.LITIGATION,
        status: CaseStatus.OPEN,
        priority: Priority.HIGH,
        ownerId: counselId,
      },
    });
  }

  it('transfers ownership and writes activity log', async () => {
    await createCounselCase('CASE-OFF-00001', 'Offboarding Case 1');
    await createCounselCase('CASE-OFF-00002', 'Offboarding Case 2');

    const response = await request(app.getHttpServer())
      .post('/api/v1/offboarding/transfer')
      .set(authHeader(adminToken))
      .send({
        fromUserId: counselId,
        toUserId: counsel2Id,
      })
      .expect(200);

    expect(response.body.data).toEqual({
      cases: 2,
      contracts: 0,
      notices: 0,
      tasks: 0,
      deadlines: 0,
    });

    const prisma = getTestPrisma();
    const transferredCases = await prisma.legalCase.findMany({
      where: { referenceCode: { startsWith: 'CASE-OFF-' } },
      select: { ownerId: true },
    });

    expect(transferredCases).toHaveLength(2);
    expect(transferredCases.every((item) => item.ownerId === counsel2Id)).toBe(
      true,
    );

    const activityLog = await prisma.activityLog.findFirst({
      where: {
        action: AuditAction.OWNERSHIP_TRANSFERRED,
        entityType: EntityType.USER,
        entityId: counsel2Id,
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activityLog).toBeTruthy();
    expect(activityLog?.metadata).toMatchObject({
      fromUserId: counselId,
      toUserId: counsel2Id,
      counts: { cases: 2 },
    });
  });

  it('rejects counsel without admin/manager role', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/offboarding/transfer')
      .set(authHeader(counselToken))
      .send({
        fromUserId: counselId,
        toUserId: counsel2Id,
      })
      .expect(403);
  });

  it('rejects transfer when from and to users are the same', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/offboarding/transfer')
      .set(authHeader(adminToken))
      .send({
        fromUserId: counselId,
        toUserId: counselId,
      })
      .expect(400);
  });
});
