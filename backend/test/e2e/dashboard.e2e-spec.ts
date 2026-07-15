import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CaseStatus, CaseType, ContractStatus, ContractType, DeadlineStatus, NoticeStatus, Priority } from '@prisma/client';
import { authHeader, loginAs } from '../helpers/auth.helper';
import { createTestApp } from '../helpers/app.helper';
import {
  cleanupTestCases,
  cleanupTestContracts,
  cleanupTestDeadlines,
  cleanupTestNotices,
  disconnectTestPrisma,
  getTestPrisma,
  getUserIdByEmail,
  seedTestUsers,
} from '../helpers/db.helper';
import { formatDateInTimezone } from '../../src/shared/utils/date-boundary.util';

const APP_TIMEZONE = 'Asia/Tehran';

function addDaysToYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

describe('Dashboard (e2e)', () => {
  let app: INestApplication;
  let counselToken: string;
  let adminToken: string;

  beforeAll(async () => {
    await seedTestUsers();
    app = await createTestApp();
    counselToken = (await loginAs(app, 'counsel@legal.local')).token;
    adminToken = (await loginAs(app, 'admin@legal.local')).token;
  });

  beforeEach(async () => {
    await cleanupTestDeadlines();
    await cleanupTestNotices();
    await cleanupTestContracts();
    await cleanupTestCases();
    await seedTestUsers();
    counselToken = (await loginAs(app, 'counsel@legal.local')).token;
    adminToken = (await loginAs(app, 'admin@legal.local')).token;
  });

  afterAll(async () => {
    await cleanupTestDeadlines();
    await cleanupTestNotices();
    await cleanupTestContracts();
    await cleanupTestCases();
    await app.close();
    await disconnectTestPrisma();
  });

  it('returns dashboard summary for authenticated user', async () => {
    const counselId = await getUserIdByEmail('counsel@legal.local');

    await request(app.getHttpServer())
      .post('/api/v1/cases')
      .set(authHeader(counselToken))
      .send({
        title: 'Dashboard Case',
        type: CaseType.LITIGATION,
        priority: Priority.HIGH,
        status: CaseStatus.OPEN,
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/api/v1/dashboard/summary')
      .set(authHeader(counselToken))
      .expect(200);

    expect(response.body.data).toMatchObject({
      openCases: expect.any(Number),
      activeContracts: expect.any(Number),
      pendingNotices: expect.any(Number),
      overdueDeadlines: expect.any(Number),
      todayDeadlines: expect.any(Number),
      myOpenTasks: expect.any(Number),
    });
    expect(response.body.data.openCases).toBeGreaterThanOrEqual(1);

    const prisma = getTestPrisma();
    const counselCases = await prisma.legalCase.count({
      where: {
        ownerId: counselId,
        deletedAt: null,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    });
    expect(response.body.data.openCases).toBe(counselCases);
  });

  it('rejects unauthenticated dashboard requests', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/dashboard/summary')
      .expect(401);
  });

  it('allows admin to see all open cases in summary', async () => {
    const counselId = await getUserIdByEmail('counsel@legal.local');
    const counsel2Id = await getUserIdByEmail('counsel2@legal.local');
    const prisma = getTestPrisma();

    await prisma.legalCase.createMany({
      data: [
        {
          referenceCode: 'CASE-DASH-00001',
          title: 'Counsel Case',
          type: CaseType.LITIGATION,
          status: CaseStatus.OPEN,
          priority: Priority.MEDIUM,
          ownerId: counselId,
        },
        {
          referenceCode: 'CASE-DASH-00002',
          title: 'Counsel2 Case',
          type: CaseType.INTERNAL,
          status: CaseStatus.IN_PROGRESS,
          priority: Priority.LOW,
          ownerId: counsel2Id,
        },
      ],
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/dashboard/summary')
      .set(authHeader(adminToken))
      .expect(200);

    expect(response.body.data.openCases).toBe(2);
  });

  it('returns accurate contracts, notices, and deadlines counts for counsel', async () => {
    const counselId = await getUserIdByEmail('counsel@legal.local');
    const prisma = getTestPrisma();
    const today = formatDateInTimezone(new Date(), APP_TIMEZONE);
    const yesterday = addDaysToYmd(today, -1);

    await prisma.contract.create({
      data: {
        referenceCode: 'CTR-DASH-00001',
        title: 'Active Contract',
        type: ContractType.MSA,
        status: ContractStatus.ACTIVE,
        ownerId: counselId,
        counterpartyName: 'Acme',
      },
    });

    await prisma.legalNotice.create({
      data: {
        referenceCode: 'NTC-DASH-00001',
        title: 'Pending Notice',
        sender: 'Vendor',
        receivedDate: new Date('2026-07-01T00:00:00.000Z'),
        responseDeadline: new Date('2026-07-20T00:00:00.000Z'),
        status: NoticeStatus.RECEIVED,
        ownerId: counselId,
      },
    });

    const legalCase = await prisma.legalCase.create({
      data: {
        referenceCode: 'CASE-DASH-00003',
        title: 'Deadline Case',
        type: CaseType.LITIGATION,
        status: CaseStatus.OPEN,
        priority: Priority.MEDIUM,
        ownerId: counselId,
      },
    });

    await prisma.deadline.createMany({
      data: [
        {
          title: 'Overdue Dashboard Deadline',
          dueDate: new Date(`${yesterday}T00:00:00.000Z`),
          status: DeadlineStatus.PENDING,
          caseId: legalCase.id,
          createdById: counselId,
        },
        {
          title: 'Today Dashboard Deadline',
          dueDate: new Date(`${today}T00:00:00.000Z`),
          status: DeadlineStatus.PENDING,
          caseId: legalCase.id,
          createdById: counselId,
        },
      ],
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/dashboard/summary')
      .set(authHeader(counselToken))
      .expect(200);

    expect(response.body.data.activeContracts).toBe(1);
    expect(response.body.data.pendingNotices).toBe(1);
    expect(response.body.data.overdueDeadlines).toBe(1);
    expect(response.body.data.todayDeadlines).toBe(1);
  });
});
