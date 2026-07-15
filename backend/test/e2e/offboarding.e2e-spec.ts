import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  AuditAction,
  CaseStatus,
  CaseType,
  ContractStatus,
  ContractType,
  DeadlineStatus,
  EntityType,
  NoticeStatus,
  Priority,
  TaskStatus,
} from '@prisma/client';
import { authHeader, loginAs } from '../helpers/auth.helper';
import { createTestApp } from '../helpers/app.helper';
import {
  cleanupTestCases,
  cleanupTestContracts,
  cleanupTestDeadlines,
  cleanupTestNotices,
  cleanupTestTasks,
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
    await cleanupTestTasks();
    await cleanupTestDeadlines();
    await cleanupTestNotices();
    await cleanupTestContracts();
    await cleanupTestCases();
    await seedTestUsers();
    counselId = await getUserIdByEmail('counsel@legal.local');
    counsel2Id = await getUserIdByEmail('counsel2@legal.local');
    adminToken = (await loginAs(app, 'admin@legal.local')).token;
    counselToken = (await loginAs(app, 'counsel@legal.local')).token;
  });

  afterAll(async () => {
    await cleanupTestTasks();
    await cleanupTestDeadlines();
    await cleanupTestNotices();
    await cleanupTestContracts();
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

  it('transfers contracts, notices, tasks, and deadline assignees', async () => {
    const prisma = getTestPrisma();

    await createCounselCase('CASE-OFF-00003', 'Offboarding Case 3');

    await prisma.contract.create({
      data: {
        referenceCode: 'CTR-OFF-00001',
        title: 'Offboarding Contract',
        type: ContractType.MSA,
        status: ContractStatus.ACTIVE,
        ownerId: counselId,
        counterpartyName: 'Acme',
      },
    });

    await prisma.legalNotice.create({
      data: {
        referenceCode: 'NTC-OFF-00001',
        title: 'Offboarding Notice',
        sender: 'Vendor',
        receivedDate: new Date('2026-07-01T00:00:00.000Z'),
        responseDeadline: new Date('2026-07-20T00:00:00.000Z'),
        status: NoticeStatus.RECEIVED,
        ownerId: counselId,
      },
    });

    const legalCase = await prisma.legalCase.findFirstOrThrow({
      where: { referenceCode: 'CASE-OFF-00003' },
    });

    await prisma.task.create({
      data: {
        title: 'Offboarding Task',
        status: TaskStatus.TODO,
        assigneeId: counselId,
        caseId: legalCase.id,
        createdById: counselId,
      },
    });

    await prisma.deadline.create({
      data: {
        title: 'Offboarding Deadline',
        dueDate: new Date('2026-08-01T00:00:00.000Z'),
        status: DeadlineStatus.PENDING,
        caseId: legalCase.id,
        assigneeId: counselId,
        createdById: counselId,
      },
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/offboarding/transfer')
      .set(authHeader(adminToken))
      .send({
        fromUserId: counselId,
        toUserId: counsel2Id,
      })
      .expect(200);

    expect(response.body.data).toEqual({
      cases: 1,
      contracts: 1,
      notices: 1,
      tasks: 1,
      deadlines: 1,
    });

    const contract = await prisma.contract.findFirst({
      where: { referenceCode: 'CTR-OFF-00001' },
    });
    const notice = await prisma.legalNotice.findFirst({
      where: { referenceCode: 'NTC-OFF-00001' },
    });
    const task = await prisma.task.findFirst({
      where: { title: 'Offboarding Task' },
    });
    const deadline = await prisma.deadline.findFirst({
      where: { title: 'Offboarding Deadline' },
    });

    expect(contract?.ownerId).toBe(counsel2Id);
    expect(notice?.ownerId).toBe(counsel2Id);
    expect(task?.assigneeId).toBe(counsel2Id);
    expect(deadline?.assigneeId).toBe(counsel2Id);
  });
});
