import { AuditAction, EntityType, UserRole } from '@prisma/client';
import { ActivityLogService } from '../../src/shared/activity-log/activity-log.service';
import { AccessControlService } from '../../src/shared/access-control/access-control.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuthenticatedUser } from '../../src/shared/types/authenticated-user.type';

describe('ActivityLogService', () => {
  let service: ActivityLogService;
  let prisma: {
    activityLog: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock };
  };

  const admin: AuthenticatedUser = {
    id: 'admin-id',
    email: 'admin@legal.local',
    fullName: 'Admin',
    role: UserRole.LEGAL_ADMIN,
  };

  const viewer: AuthenticatedUser = {
    id: 'viewer-id',
    email: 'viewer@legal.local',
    fullName: 'Viewer',
    role: UserRole.VIEWER,
  };

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  beforeEach(() => {
    prisma = {
      activityLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-id' }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    service = new ActivityLogService(
      prisma as unknown as PrismaService,
      new AccessControlService(),
    );
  });

  describe('log()', () => {
    it('creates an activity log entry', async () => {
      await service.log({
        actorId: 'user-id',
        action: AuditAction.CREATED,
        entityType: EntityType.CASE,
        entityId: 'case-id',
        metadata: { title: 'Test Case' },
      });

      expect(prisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          actorId: 'user-id',
          action: AuditAction.CREATED,
          entityType: EntityType.CASE,
          entityId: 'case-id',
          metadata: { title: 'Test Case' },
        },
      });
    });

    it('defaults empty metadata to {}', async () => {
      await service.log({
        actorId: 'user-id',
        action: AuditAction.DELETED,
        entityType: EntityType.CASE,
        entityId: 'case-id',
      });

      expect(prisma.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ metadata: {} }),
      });
    });
  });

  describe('logWithinTransaction()', () => {
    it('calls tx.activityLog.create, not prisma.activityLog.create', async () => {
      const txCreate = jest.fn().mockResolvedValue({ id: 'tx-log-id' });
      const tx = { activityLog: { create: txCreate } };

      await service.logWithinTransaction(tx as any, {
        actorId: 'user-id',
        action: AuditAction.UPDATED,
        entityType: EntityType.CONTRACT,
        entityId: 'contract-id',
        metadata: { field: 'status' },
      });

      expect(txCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'user-id',
          action: AuditAction.UPDATED,
          entityType: EntityType.CONTRACT,
          entityId: 'contract-id',
          metadata: { field: 'status' },
        }),
      });
      expect(prisma.activityLog.create).not.toHaveBeenCalled();
    });

    it('defaults empty metadata to {} inside transaction', async () => {
      const txCreate = jest.fn().mockResolvedValue({ id: 'tx-log-id' });

      await service.logWithinTransaction(
        { activityLog: { create: txCreate } } as any,
        {
          actorId: 'user-id',
          action: AuditAction.CREATED,
          entityType: EntityType.NOTICE,
          entityId: 'notice-id',
        },
      );

      expect(txCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ metadata: {} }),
      });
    });
  });

  describe('list() actor scoping', () => {
    it('admin: no actorId scope injected into where', async () => {
      await service.list({}, admin);

      const callArg = prisma.activityLog.findMany.mock.calls[0][0];
      expect(callArg.where).not.toHaveProperty('actorId');
    });

    it('viewer: no actorId scope injected into where', async () => {
      await service.list({}, viewer);

      const callArg = prisma.activityLog.findMany.mock.calls[0][0];
      expect(callArg.where).not.toHaveProperty('actorId');
    });

    it('counsel: where includes actorId: counsel.id', async () => {
      await service.list({}, counsel);

      const callArg = prisma.activityLog.findMany.mock.calls[0][0];
      expect(callArg.where).toMatchObject({ actorId: counsel.id });
    });

    it('counsel with skipCounselActorScope true: no actorId scope', async () => {
      await service.list({}, counsel, { skipCounselActorScope: true });

      const callArg = prisma.activityLog.findMany.mock.calls[0][0];
      expect(callArg.where).not.toHaveProperty('actorId');
    });
  });

  describe('list() filters and pagination', () => {
    it('applies entityType and entityId filters', async () => {
      await service.list(
        { entityType: EntityType.CASE, entityId: 'case-id' },
        admin,
      );

      const callArg = prisma.activityLog.findMany.mock.calls[0][0];
      expect(callArg.where).toMatchObject({
        entityType: EntityType.CASE,
        entityId: 'case-id',
      });
    });

    it('applies explicit actorId filter', async () => {
      await service.list({ actorId: 'specific-actor' }, admin);

      const callArg = prisma.activityLog.findMany.mock.calls[0][0];
      expect(callArg.where).toMatchObject({ actorId: 'specific-actor' });
    });

    it('applies pagination skip and take correctly', async () => {
      await service.list({ page: 3, limit: 5 }, admin);

      const callArg = prisma.activityLog.findMany.mock.calls[0][0];
      expect(callArg.skip).toBe(10); // (3 - 1) * 5
      expect(callArg.take).toBe(5);
    });

    it('returns items, total, page and limit', async () => {
      prisma.activityLog.findMany.mockResolvedValue([{ id: 'log-1' }]);
      prisma.activityLog.count.mockResolvedValue(7);

      const result = await service.list({ page: 2, limit: 3 }, admin);

      expect(result).toEqual({
        items: [{ id: 'log-1' }],
        total: 7,
        page: 2,
        limit: 3,
      });
    });

    it('uses page 1 and limit 20 as defaults', async () => {
      await service.list({}, admin);

      const callArg = prisma.activityLog.findMany.mock.calls[0][0];
      expect(callArg.skip).toBe(0);
      expect(callArg.take).toBe(20);
    });
  });
});
