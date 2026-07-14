import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  CaseStatus,
  CaseType,
  EntityType,
  PartyType,
  Priority,
  UserRole,
} from '@prisma/client';
import { CreateCaseUseCase } from '../../../src/modules/cases/application/create-case.use-case';
import { PrismaCaseRepository } from '../../../src/modules/cases/infrastructure/prisma-case.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('CreateCaseUseCase', () => {
  let useCase: CreateCaseUseCase;
  let caseRepository: jest.Mocked<
    Pick<
      PrismaCaseRepository,
      | 'generateNextReferenceCode'
      | 'create'
      | 'userExistsAndActive'
    >
  >;
  let activityLogService: jest.Mocked<Pick<ActivityLogService, 'log'>>;
  let accessControl: AccessControlService;

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
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

  const createdCase = {
    id: 'case-1',
    referenceCode: 'CASE-2026-00001',
    title: 'Test Case',
    type: CaseType.LITIGATION,
    status: CaseStatus.OPEN,
    priority: Priority.HIGH,
    ownerId: counsel.id,
    description: null,
    openedDate: null,
    closedDate: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    parties: [],
  };

  beforeEach(() => {
    caseRepository = {
      generateNextReferenceCode: jest.fn().mockResolvedValue('CASE-2026-00001'),
      create: jest.fn().mockResolvedValue(createdCase),
      userExistsAndActive: jest.fn().mockResolvedValue(true),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    accessControl = new AccessControlService();

    useCase = new CreateCaseUseCase(
      caseRepository as unknown as PrismaCaseRepository,
      accessControl,
      activityLogService as unknown as ActivityLogService,
    );
  });

  it('creates a case for counsel with self as owner', async () => {
    const result = await useCase.execute(counsel, {
      title: 'Test Case',
      type: CaseType.LITIGATION,
      priority: Priority.HIGH,
    });

    expect(result.data).toEqual(createdCase);
    expect(caseRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: counsel.id,
        referenceCode: 'CASE-2026-00001',
        status: CaseStatus.OPEN,
      }),
    );
    expect(activityLogService.log).toHaveBeenCalledWith({
      actorId: counsel.id,
      action: AuditAction.CREATED,
      entityType: EntityType.CASE,
      entityId: createdCase.id,
      metadata: expect.objectContaining({
        referenceCode: 'CASE-2026-00001',
        partyCount: 0,
      }),
    });
  });

  it('creates a case with optional parties', async () => {
    const parties = [
      {
        name: 'Acme Corp',
        partyType: PartyType.DEFENDANT,
        contactInfo: 'legal@acme.com',
      },
    ];

    await useCase.execute(counsel, {
      title: 'Test Case',
      type: CaseType.LITIGATION,
      priority: Priority.HIGH,
      parties,
    });

    expect(caseRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ parties }),
    );
  });

  it('allows manager to assign a different owner', async () => {
    const otherOwnerId = 'other-owner-id';

    await useCase.execute(manager, {
      title: 'Assigned Case',
      type: CaseType.REGULATORY,
      priority: Priority.MEDIUM,
      ownerId: otherOwnerId,
    });

    expect(caseRepository.userExistsAndActive).toHaveBeenCalledWith(otherOwnerId);
    expect(caseRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: otherOwnerId }),
    );
  });

  it('rejects counsel assigning a different owner', async () => {
    await expect(
      useCase.execute(counsel, {
        title: 'Test Case',
        type: CaseType.LITIGATION,
        priority: Priority.HIGH,
        ownerId: 'other-owner-id',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects viewer mutations', async () => {
    await expect(
      useCase.execute(viewer, {
        title: 'Test Case',
        type: CaseType.LITIGATION,
        priority: Priority.HIGH,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when assigned owner does not exist', async () => {
    caseRepository.userExistsAndActive.mockResolvedValue(false);

    await expect(
      useCase.execute(manager, {
        title: 'Test Case',
        type: CaseType.LITIGATION,
        priority: Priority.HIGH,
        ownerId: 'missing-owner',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
