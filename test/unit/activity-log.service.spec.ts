import { AuditAction, EntityType } from '@prisma/client';
import { ActivityLogService } from '../../src/shared/activity-log/activity-log.service';
import { AccessControlService } from '../../src/shared/access-control/access-control.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('ActivityLogService', () => {
  let service: ActivityLogService;
  let prisma: {
    activityLog: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock };
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
});
