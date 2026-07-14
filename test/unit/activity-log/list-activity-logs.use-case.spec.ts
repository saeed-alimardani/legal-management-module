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
    legalCase: { findFirst: jest.Mock };
    contract: { findFirst: jest.Mock };
    legalNotice: { findFirst: jest.Mock };
    deadline: { findUnique: jest.Mock };
    task: { findUnique: jest.Mock };
    document: { findFirst: jest.Mock };
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
      legalCase: { findFirst: jest.fn() },
      contract: { findFirst: jest.fn() },
      legalNotice: { findFirst: jest.fn() },
      deadline: { findUnique: jest.fn() },
      task: { findUnique: jest.fn() },
      document: { findFirst: jest.fn() },
    };

    useCase = new ListActivityLogsUseCase(
      { list: activityLogList } as unknown as ActivityLogService,
      new AccessControlService(),
      prisma as unknown as PrismaService,
    );
  });

  describe('unscoped list (no entityType / entityId)', () => {
    it('calls list with skipCounselActorScope false for counsel', async () => {
      await useCase.execute(counsel, { page: 1, limit: 20 });

      expect(activityLogList).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 20 }),
        counsel,
        { skipCounselActorScope: false },
      );
    });

    it('returns paginated response with data and meta', async () => {
      const items = [{ id: 'log-1' }];
      activityLogList.mockResolvedValue({ items, total: 1, page: 1, limit: 20 });

      const result = await useCase.execute(admin, { page: 1, limit: 20 });

      expect(result).toEqual({ data: items, meta: { page: 1, limit: 20, total: 1 } });
    });
  });

  describe('entity-scoped CASE', () => {
    it('counsel owns case → skipCounselActorScope true, returns paginated response', async () => {
      prisma.legalCase.findFirst.mockResolvedValue({ ownerId: counselId });
      const items = [{ id: 'log-2' }];
      activityLogList.mockResolvedValue({ items, total: 1, page: 1, limit: 20 });

      const result = await useCase.execute(counsel, {
        entityType: EntityType.CASE,
        entityId,
        page: 1,
        limit: 20,
      });

      expect(activityLogList).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: EntityType.CASE, entityId }),
        counsel,
        { skipCounselActorScope: true },
      );
      expect(result).toEqual({ data: items, meta: { page: 1, limit: 20, total: 1 } });
    });

    it('counsel does not own case → ForbiddenException', async () => {
      prisma.legalCase.findFirst.mockResolvedValue({ ownerId: 'other-id' });

      await expect(
        useCase.execute(counsel, { entityType: EntityType.CASE, entityId, page: 1, limit: 20 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('case not found → NotFoundException', async () => {
      prisma.legalCase.findFirst.mockResolvedValue(null);

      await expect(
        useCase.execute(counsel, { entityType: EntityType.CASE, entityId, page: 1, limit: 20 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('entity-scoped CONTRACT', () => {
    it('counsel owns contract → success', async () => {
      prisma.contract.findFirst.mockResolvedValue({ ownerId: counselId });

      await expect(
        useCase.execute(counsel, { entityType: EntityType.CONTRACT, entityId, page: 1, limit: 20 }),
      ).resolves.toBeDefined();
    });

    it('contract not found → NotFoundException', async () => {
      prisma.contract.findFirst.mockResolvedValue(null);

      await expect(
        useCase.execute(counsel, { entityType: EntityType.CONTRACT, entityId, page: 1, limit: 20 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('entity-scoped NOTICE', () => {
    it('counsel owns notice → success', async () => {
      prisma.legalNotice.findFirst.mockResolvedValue({ ownerId: counselId });

      await expect(
        useCase.execute(counsel, { entityType: EntityType.NOTICE, entityId, page: 1, limit: 20 }),
      ).resolves.toBeDefined();
    });
  });

  describe('entity-scoped DEADLINE', () => {
    it('counsel is assignee → can view', async () => {
      prisma.deadline.findUnique.mockResolvedValue({
        assigneeId: counselId,
        legalCase: { ownerId: 'other-owner', deletedAt: null },
        contract: null,
        notice: null,
      });

      await expect(
        useCase.execute(counsel, { entityType: EntityType.DEADLINE, entityId, page: 1, limit: 20 }),
      ).resolves.toBeDefined();
    });

    it('deadline not found → NotFoundException', async () => {
      prisma.deadline.findUnique.mockResolvedValue(null);

      await expect(
        useCase.execute(counsel, { entityType: EntityType.DEADLINE, entityId, page: 1, limit: 20 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('entity-scoped TASK', () => {
    it('counsel is assignee → can view', async () => {
      prisma.task.findUnique.mockResolvedValue({
        assigneeId: counselId,
        legalCase: { ownerId: 'other-owner', deletedAt: null },
        contract: null,
        notice: null,
      });

      await expect(
        useCase.execute(counsel, { entityType: EntityType.TASK, entityId, page: 1, limit: 20 }),
      ).resolves.toBeDefined();
    });

    it('task not found → NotFoundException', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(
        useCase.execute(counsel, { entityType: EntityType.TASK, entityId, page: 1, limit: 20 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('entity-scoped DOCUMENT', () => {
    it('parent case owner → can view', async () => {
      prisma.document.findFirst.mockResolvedValue({
        legalCase: { ownerId: counselId, deletedAt: null },
        contract: null,
        notice: null,
      });

      await expect(
        useCase.execute(counsel, { entityType: EntityType.DOCUMENT, entityId, page: 1, limit: 20 }),
      ).resolves.toBeDefined();
    });

    it('document not found → NotFoundException', async () => {
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(
        useCase.execute(counsel, { entityType: EntityType.DOCUMENT, entityId, page: 1, limit: 20 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('unsupported entity type', () => {
    it('USER entityType → ForbiddenException', async () => {
      await expect(
        useCase.execute(counsel, { entityType: EntityType.USER, entityId, page: 1, limit: 20 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('admin and viewer skip entity ownership check', () => {
    it('admin accesses entity-scoped log without DB lookup', async () => {
      await useCase.execute(admin, {
        entityType: EntityType.CASE,
        entityId,
        page: 1,
        limit: 20,
      });

      expect(prisma.legalCase.findFirst).not.toHaveBeenCalled();
      expect(activityLogList).toHaveBeenCalledWith(
        expect.anything(),
        admin,
        { skipCounselActorScope: true },
      );
    });

    it('viewer accesses entity-scoped log without DB lookup', async () => {
      await useCase.execute(viewer, {
        entityType: EntityType.CASE,
        entityId,
        page: 1,
        limit: 20,
      });

      expect(prisma.legalCase.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('pagination forwarded', () => {
    it('passes custom page and limit to list', async () => {
      activityLogList.mockResolvedValue({ items: [], total: 0, page: 3, limit: 5 });

      await useCase.execute(admin, { page: 3, limit: 5 });

      expect(activityLogList).toHaveBeenCalledWith(
        expect.objectContaining({ page: 3, limit: 5 }),
        admin,
        { skipCounselActorScope: false },
      );
    });

    it('result meta reflects page and limit from list response', async () => {
      activityLogList.mockResolvedValue({ items: [], total: 50, page: 2, limit: 10 });

      const result = await useCase.execute(admin, { page: 2, limit: 10 });

      expect(result.meta).toEqual({ page: 2, limit: 10, total: 50 });
    });
  });
});
