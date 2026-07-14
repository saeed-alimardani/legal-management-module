import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  CaseStatus,
  CaseType,
  EntityType,
  Priority,
  UserRole,
} from '@prisma/client';
import { GetCaseTimelineUseCase } from '../../../src/modules/cases/application/get-case-timeline.use-case';
import { PrismaCaseRepository } from '../../../src/modules/cases/infrastructure/prisma-case.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('GetCaseTimelineUseCase', () => {
  let useCase: GetCaseTimelineUseCase;
  let caseRepository: jest.Mocked<Pick<PrismaCaseRepository, 'findById'>>;
  let activityLogService: jest.Mocked<Pick<ActivityLogService, 'list'>>;

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  const otherCounsel: AuthenticatedUser = {
    id: 'counsel2-id',
    email: 'counsel2@legal.local',
    fullName: 'Counsel Two',
    role: UserRole.LEGAL_COUNSEL,
  };

  const legalCase = {
    id: 'case-1',
    ownerId: counsel.id,
    referenceCode: 'CASE-2026-00001',
    title: 'Case',
    type: CaseType.LITIGATION,
    status: CaseStatus.OPEN,
    priority: Priority.HIGH,
    description: null,
    openedDate: null,
    closedDate: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    parties: [],
  };

  const timelineItems = [
    {
      id: 'log-1',
      action: AuditAction.CREATED,
      entityType: EntityType.CASE,
      entityId: legalCase.id,
      actorId: counsel.id,
      metadata: null,
      createdAt: new Date(),
    },
  ];

  beforeEach(() => {
    caseRepository = {
      findById: jest.fn().mockResolvedValue(legalCase),
    };

    activityLogService = {
      list: jest.fn().mockResolvedValue({ items: timelineItems, total: 1 }),
    };

    useCase = new GetCaseTimelineUseCase(
      caseRepository as unknown as PrismaCaseRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
    );
  });

  it('returns paginated timeline for authorized user', async () => {
    const result = await useCase.execute(counsel, legalCase.id, 1, 20);

    expect(activityLogService.list).toHaveBeenCalledWith(
      {
        entityType: EntityType.CASE,
        entityId: legalCase.id,
        page: 1,
        limit: 20,
      },
      counsel,
      { skipCounselActorScope: true },
    );
    expect(result.data).toEqual(timelineItems);
    expect(result.meta.total).toBe(1);
  });

  it('denies unauthorized counsel', async () => {
    await expect(
      useCase.execute(otherCounsel, legalCase.id, 1, 20),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when case not found', async () => {
    caseRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(counsel, 'missing', 1, 20),
    ).rejects.toThrow(NotFoundException);
  });
});
