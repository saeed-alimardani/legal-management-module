import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityType, UserRole } from '@prisma/client';
import { ListActivityLogsUseCase } from '../../../src/modules/activity-log/application/list-activity-logs.use-case';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('ListActivityLogsUseCase', () => {
  let useCase: ListActivityLogsUseCase;
  let activityLogList: jest.Mock;
  let prisma: {
    legalCase: { findFirst: jest.Mock; count: jest.Mock };
    contract: { findFirst: jest.Mock; count: jest.Mock };
    legalNotice: { findFirst: jest.Mock; count: jest.Mock };
    deadline: { findUnique: jest.Mock };
    task: { findUnique: jest.Mock };
    document: { findFirst: jest.Mock; count: jest.Mock };
    discussion: { findFirst: jest.Mock; count: jest.Mock };
    financialRecord: { findFirst: jest.Mock; count: jest.Mock };
  };

  const counselId = 'counsel-id';
  const entityId = 'entity-id';

  const counsel: AuthenticatedUser = {
    id: counselId,
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  const admin: AuthenticatedUser = {
    id: 'admin-id',
    email: 'admin@legal.local',
    fullName: 'Admin',
    role: UserRole.LEGAL_ADMIN,
  };

  const manager: AuthenticatedUser = {
    id: 'manager-id',
    email: 'manager@legal.local',
    fullName: 'Manager',
    role: UserRole.LEGAL_MANAGER,
  };

  const viewer: AuthenticatedUser = {
    id: 'viewer-id',
    email: 'viewer@legal.local',
    fullName: 'Viewer',
    role: UserRole.VIEWER,
  };

  const defaultListResult = { items: [], total: 0, page: 1, limit: 20 };

  beforeEach(() => {
    activityLogList = jest.fn().mockResolvedValue(defaultListResult);
    prisma = {
      legalCase: { findFirst: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      contract: { findFirst: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      legalNotice: { findFirst: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      deadline: { findUnique: jest.fn() },
      task: { findUnique: jest.fn() },
      document: { findFirst: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      discussion: { findFirst: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      financialRecord: {
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    useCase = new ListActivityLogsUseCase(
      { list: activityLogList } as unknown as ActivityLogService,
      new AccessControlService(),
      prisma as unknown as PrismaService,
    );
  });

  describe('unscoped list (no entityType / entityId)', () => {
    it('denies counsel', async () => {
      await expect(
        useCase.execute(counsel, { page: 1, limit: 20 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies manager', async () => {
      await expect(
        useCase.execute(manager, { page: 1, limit: 20 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns paginated response with data and meta for admin', async () => {
      const items = [{ id: 'log-1' }];
      activityLogList.mockResolvedValue({
        items,
        total: 1,
        page: 1,
        limit: 20,
      });

      const result = await useCase.execute(admin, { page: 1, limit: 20 });

      expect(result).toEqual({
        data: items,
        meta: { page: 1, limit: 20, total: 1 },
      });
    });
  });

  describe('entity-scoped CASE', () => {
    it('admin can access entity-scoped case logs', async () => {
      const items = [{ id: 'log-2' }];
      activityLogList.mockResolvedValue({
        items,
        total: 1,
        page: 1,
        limit: 20,
      });

      const result = await useCase.execute(admin, {
        entityType: EntityType.CASE,
        entityId,
        page: 1,
        limit: 20,
      });

      expect(activityLogList).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: EntityType.CASE, entityId }),
        admin,
        { skipCounselActorScope: true },
      );
      expect(result).toEqual({
        data: items,
        meta: { page: 1, limit: 20, total: 1 },
      });
    });

    it('counsel is denied before entity lookup', async () => {
      await expect(
        useCase.execute(counsel, {
          entityType: EntityType.CASE,
          entityId,
          page: 1,
          limit: 20,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.legalCase.findFirst).not.toHaveBeenCalled();
    });

    it('admin skips missing entity validation for scoped queries', async () => {
      prisma.legalCase.findFirst.mockResolvedValue(null);

      await expect(
        useCase.execute(admin, {
          entityType: EntityType.CASE,
          entityId,
          page: 1,
          limit: 20,
        }),
      ).resolves.toEqual({
        data: [],
        meta: { page: 1, limit: 20, total: 0 },
      });
      expect(prisma.legalCase.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('entity-scoped CONTRACT', () => {
    it('admin can access entity-scoped contract logs', async () => {
      await expect(
        useCase.execute(admin, {
          entityType: EntityType.CONTRACT,
          entityId,
          page: 1,
          limit: 20,
        }),
      ).resolves.toBeDefined();
    });

    it('admin skips missing contract validation', async () => {
      prisma.contract.findFirst.mockResolvedValue(null);

      await expect(
        useCase.execute(admin, {
          entityType: EntityType.CONTRACT,
          entityId,
          page: 1,
          limit: 20,
        }),
      ).resolves.toBeDefined();
      expect(prisma.contract.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('entity-scoped NOTICE', () => {
    it('admin can access entity-scoped notice logs', async () => {
      await expect(
        useCase.execute(admin, {
          entityType: EntityType.NOTICE,
          entityId,
          page: 1,
          limit: 20,
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('entity-scoped DEADLINE', () => {
    it('admin can access entity-scoped deadline logs', async () => {
      prisma.deadline.findUnique.mockResolvedValue({
        assigneeId: counselId,
        legalCase: { id: 'case-1', ownerId: 'other-owner', deletedAt: null },
        contract: null,
        notice: null,
      });

      await expect(
        useCase.execute(admin, {
          entityType: EntityType.DEADLINE,
          entityId,
          page: 1,
          limit: 20,
        }),
      ).resolves.toBeDefined();
    });

    it('admin skips missing deadline validation', async () => {
      prisma.deadline.findUnique.mockResolvedValue(null);

      await expect(
        useCase.execute(admin, {
          entityType: EntityType.DEADLINE,
          entityId,
          page: 1,
          limit: 20,
        }),
      ).resolves.toBeDefined();
      expect(prisma.deadline.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('entity-scoped TASK', () => {
    it('admin can access entity-scoped task logs', async () => {
      prisma.task.findUnique.mockResolvedValue({
        assigneeId: counselId,
        createdById: 'creator-id',
        legalCase: { id: 'case-1', ownerId: 'other-owner', deletedAt: null },
        contract: null,
        notice: null,
      });

      await expect(
        useCase.execute(admin, {
          entityType: EntityType.TASK,
          entityId,
          page: 1,
          limit: 20,
        }),
      ).resolves.toBeDefined();
    });

    it('admin skips missing task validation', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(
        useCase.execute(admin, {
          entityType: EntityType.TASK,
          entityId,
          page: 1,
          limit: 20,
        }),
      ).resolves.toBeDefined();
      expect(prisma.task.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('entity-scoped DOCUMENT', () => {
    it('admin can access entity-scoped document logs', async () => {
      prisma.document.findFirst.mockResolvedValue({
        legalCase: { ownerId: counselId, deletedAt: null },
        contract: null,
        notice: null,
      });

      await expect(
        useCase.execute(admin, {
          entityType: EntityType.DOCUMENT,
          entityId,
          page: 1,
          limit: 20,
        }),
      ).resolves.toBeDefined();
    });

    it('admin skips missing document validation', async () => {
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(
        useCase.execute(admin, {
          entityType: EntityType.DOCUMENT,
          entityId,
          page: 1,
          limit: 20,
        }),
      ).resolves.toBeDefined();
      expect(prisma.document.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('unsupported entity type', () => {
    it('admin can query USER entityType without ownership checks', async () => {
      await expect(
        useCase.execute(admin, {
          entityType: EntityType.USER,
          entityId,
          page: 1,
          limit: 20,
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('admin skips entity ownership check', () => {
    it('admin accesses entity-scoped log without DB lookup', async () => {
      await useCase.execute(admin, {
        entityType: EntityType.CASE,
        entityId,
        page: 1,
        limit: 20,
      });

      expect(prisma.legalCase.findFirst).not.toHaveBeenCalled();
      expect(activityLogList).toHaveBeenCalledWith(expect.anything(), admin, {
        skipCounselActorScope: true,
      });
    });
  });

  describe('viewer entity access', () => {
    it('viewer is denied before entity lookup', async () => {
      await expect(
        useCase.execute(viewer, {
          entityType: EntityType.CASE,
          entityId,
          page: 1,
          limit: 20,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.legalCase.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('pagination forwarded', () => {
    it('passes custom page and limit to list', async () => {
      activityLogList.mockResolvedValue({
        items: [],
        total: 0,
        page: 3,
        limit: 5,
      });

      await useCase.execute(admin, { page: 3, limit: 5 });

      expect(activityLogList).toHaveBeenCalledWith(
        expect.objectContaining({ page: 3, limit: 5 }),
        admin,
        { skipCounselActorScope: false },
      );
    });

    it('result meta reflects page and limit from list response', async () => {
      activityLogList.mockResolvedValue({
        items: [],
        total: 50,
        page: 2,
        limit: 10,
      });

      const result = await useCase.execute(admin, { page: 2, limit: 10 });

      expect(result.meta).toEqual({ page: 2, limit: 10, total: 50 });
    });
  });
});
