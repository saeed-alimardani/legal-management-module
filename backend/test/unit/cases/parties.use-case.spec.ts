import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  CaseStatus,
  CaseType,
  EntityType,
  PartyType,
  Priority,
  UserRole,
} from '@prisma/client';
import { AddPartyUseCase } from '../../../src/modules/cases/application/add-party.use-case';
import { DeletePartyUseCase } from '../../../src/modules/cases/application/delete-party.use-case';
import { ListPartiesUseCase } from '../../../src/modules/cases/application/list-parties.use-case';
import { UpdatePartyUseCase } from '../../../src/modules/cases/application/update-party.use-case';
import { PrismaCaseRepository } from '../../../src/modules/cases/infrastructure/prisma-case.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('ListPartiesUseCase', () => {
  let useCase: ListPartiesUseCase;
  let caseRepository: jest.Mocked<
    Pick<PrismaCaseRepository, 'findById' | 'listParties'>
  >;

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

  const parties = [
    {
      id: 'party-1',
      caseId: legalCase.id,
      name: 'Acme',
      partyType: PartyType.DEFENDANT,
      contactInfo: null,
      notes: null,
    },
  ];

  beforeEach(() => {
    caseRepository = {
      findById: jest.fn().mockResolvedValue(legalCase),
      listParties: jest.fn().mockResolvedValue(parties),
    };

    useCase = new ListPartiesUseCase(
      caseRepository as unknown as PrismaCaseRepository,
      new AccessControlService(),
    );
  });

  it('returns parties for authorized user', async () => {
    const result = await useCase.execute(counsel, legalCase.id);

    expect(result.data).toEqual(parties);
  });

  it('denies unauthorized counsel', async () => {
    await expect(useCase.execute(otherCounsel, legalCase.id)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws when case not found', async () => {
    caseRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(counsel, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('AddPartyUseCase', () => {
  let useCase: AddPartyUseCase;
  let caseRepository: jest.Mocked<
    Pick<PrismaCaseRepository, 'findById' | 'addParty'>
  >;
  let activityLogService: jest.Mocked<Pick<ActivityLogService, 'log'>>;

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
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

  const newParty = {
    id: 'party-2',
    caseId: legalCase.id,
    name: 'Beta LLC',
    partyType: PartyType.PLAINTIFF,
    contactInfo: 'contact@beta.com',
    notes: null,
  };

  beforeEach(() => {
    caseRepository = {
      findById: jest.fn().mockResolvedValue(legalCase),
      addParty: jest.fn().mockResolvedValue(newParty),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new AddPartyUseCase(
      caseRepository as unknown as PrismaCaseRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
    );
  });

  it('adds party and logs activity', async () => {
    const result = await useCase.execute(counsel, legalCase.id, {
      name: newParty.name,
      partyType: newParty.partyType,
      contactInfo: newParty.contactInfo,
    });

    expect(result.data).toEqual(newParty);
    expect(activityLogService.log).toHaveBeenCalledWith({
      actorId: counsel.id,
      action: AuditAction.UPDATED,
      entityType: EntityType.CASE,
      entityId: legalCase.id,
      metadata: {
        partyAdded: {
          id: newParty.id,
          name: newParty.name,
          partyType: newParty.partyType,
        },
      },
    });
  });
});

describe('UpdatePartyUseCase', () => {
  let useCase: UpdatePartyUseCase;
  let caseRepository: jest.Mocked<
    Pick<
      PrismaCaseRepository,
      'findById' | 'findPartyById' | 'updateParty'
    >
  >;
  let activityLogService: jest.Mocked<Pick<ActivityLogService, 'log'>>;

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

  const existingParty = {
    id: 'party-1',
    caseId: legalCase.id,
    name: 'Acme',
    partyType: PartyType.DEFENDANT,
    contactInfo: null,
    notes: null,
  };

  const updatedParty = {
    ...existingParty,
    name: 'Acme Corp',
    contactInfo: 'contact@acme.com',
  };

  beforeEach(() => {
    caseRepository = {
      findById: jest.fn().mockResolvedValue(legalCase),
      findPartyById: jest.fn().mockResolvedValue(existingParty),
      updateParty: jest.fn().mockResolvedValue(updatedParty),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new UpdatePartyUseCase(
      caseRepository as unknown as PrismaCaseRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
    );
  });

  it('updates party and logs activity', async () => {
    const result = await useCase.execute(counsel, legalCase.id, existingParty.id, {
      name: 'Acme Corp',
      contactInfo: 'contact@acme.com',
    });

    expect(result.data).toEqual(updatedParty);
    expect(activityLogService.log).toHaveBeenCalledWith({
      actorId: counsel.id,
      action: AuditAction.UPDATED,
      entityType: EntityType.CASE,
      entityId: legalCase.id,
      metadata: {
        partyUpdated: {
          id: updatedParty.id,
          name: updatedParty.name,
          partyType: updatedParty.partyType,
        },
      },
    });
  });

  it('denies unauthorized counsel', async () => {
    await expect(
      useCase.execute(otherCounsel, legalCase.id, existingParty.id, {
        name: 'Acme Corp',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when case not found', async () => {
    caseRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(counsel, 'missing', existingParty.id, {
        name: 'Acme Corp',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws when party not found', async () => {
    caseRepository.findPartyById.mockResolvedValue(null);

    await expect(
      useCase.execute(counsel, legalCase.id, 'missing', {
        name: 'Acme Corp',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('DeletePartyUseCase', () => {
  let useCase: DeletePartyUseCase;
  let caseRepository: jest.Mocked<
    Pick<
      PrismaCaseRepository,
      'findById' | 'findPartyById' | 'deleteParty'
    >
  >;
  let activityLogService: jest.Mocked<Pick<ActivityLogService, 'log'>>;

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

  const existingParty = {
    id: 'party-1',
    caseId: legalCase.id,
    name: 'Acme',
    partyType: PartyType.DEFENDANT,
    contactInfo: null,
    notes: null,
  };

  beforeEach(() => {
    caseRepository = {
      findById: jest.fn().mockResolvedValue(legalCase),
      findPartyById: jest.fn().mockResolvedValue(existingParty),
      deleteParty: jest.fn().mockResolvedValue(undefined),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new DeletePartyUseCase(
      caseRepository as unknown as PrismaCaseRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
    );
  });

  it('deletes party and logs activity', async () => {
    const result = await useCase.execute(counsel, legalCase.id, existingParty.id);

    expect(result.data).toEqual({ id: existingParty.id, deleted: true });
    expect(caseRepository.deleteParty).toHaveBeenCalledWith(
      legalCase.id,
      existingParty.id,
    );
    expect(activityLogService.log).toHaveBeenCalledWith({
      actorId: counsel.id,
      action: AuditAction.UPDATED,
      entityType: EntityType.CASE,
      entityId: legalCase.id,
      metadata: {
        partyRemoved: {
          id: existingParty.id,
          name: existingParty.name,
        },
      },
    });
  });

  it('denies unauthorized counsel', async () => {
    await expect(
      useCase.execute(otherCounsel, legalCase.id, existingParty.id),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when case not found', async () => {
    caseRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(counsel, 'missing', existingParty.id),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws when party not found', async () => {
    caseRepository.findPartyById.mockResolvedValue(null);

    await expect(
      useCase.execute(counsel, legalCase.id, 'missing'),
    ).rejects.toThrow(NotFoundException);
  });
});
