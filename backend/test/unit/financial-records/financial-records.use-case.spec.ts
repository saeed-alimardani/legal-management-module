import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  EntityType,
  FinancialRecordType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { CreateFinancialRecordUseCase } from '../../../src/modules/financial-records/application/create-financial-record.use-case';
import { DeleteFinancialRecordUseCase } from '../../../src/modules/financial-records/application/delete-financial-record.use-case';
import { GetFinancialRecordUseCase } from '../../../src/modules/financial-records/application/get-financial-record.use-case';
import { ListFinancialRecordsUseCase } from '../../../src/modules/financial-records/application/list-financial-records.use-case';
import { UpdateFinancialRecordUseCase } from '../../../src/modules/financial-records/application/update-financial-record.use-case';
import { FinancialRecordWithParent } from '../../../src/modules/financial-records/domain/financial-record.types';
import { PrismaFinancialRecordRepository } from '../../../src/modules/financial-records/infrastructure/prisma-financial-record.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';
import { createMockConfigService } from '../../helpers/config.helper';

describe('CreateFinancialRecordUseCase', () => {
  let useCase: CreateFinancialRecordUseCase;
  let financialRecordRepository: jest.Mocked<
    Pick<PrismaFinancialRecordRepository, 'findParentOwner' | 'create'>
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

  const viewer: AuthenticatedUser = {
    id: 'viewer-id',
    email: 'viewer@legal.local',
    fullName: 'Viewer',
    role: UserRole.VIEWER,
  };

  const createdAt = new Date('2026-07-14T10:00:00.000Z');

  const buildRecord = (): FinancialRecordWithParent => ({
    id: 'fr-1',
    title: 'Legal fee',
    amount: new Prisma.Decimal('1000.00'),
    currency: 'IRR',
    type: FinancialRecordType.EXPENSE,
    description: null,
    recordDate: new Date('2026-07-14T00:00:00.000Z'),
    caseId: 'case-1',
    contractId: null,
    createdById: counsel.id,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
    legalCase: { ownerId: counsel.id, deletedAt: null },
    contract: null,
  });

  beforeEach(() => {
    financialRecordRepository = {
      findParentOwner: jest.fn().mockResolvedValue({ ownerId: counsel.id }),
      create: jest.fn().mockResolvedValue(buildRecord()),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new CreateFinancialRecordUseCase(
      financialRecordRepository as unknown as PrismaFinancialRecordRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
      createMockConfigService() as unknown as ConfigService,
    );
  });

  it('creates financial record on owned case and logs activity', async () => {
    const result = await useCase.execute(counsel, {
      title: 'Legal fee',
      amount: 1000,
      type: FinancialRecordType.EXPENSE,
      recordDate: new Date('2026-07-14T15:30:00.000Z'),
      caseId: 'case-1',
    });

    expect(result.data.title).toBe('Legal fee');
    expect(result.data.amount).toBe('1000.00');
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATED,
        entityType: EntityType.FINANCIAL_RECORD,
        entityId: 'fr-1',
        actorId: counsel.id,
      }),
    );
  });

  it('throws 400 when no parent FK is provided', async () => {
    await expect(
      useCase.execute(counsel, {
        title: 'Legal fee',
        amount: 1000,
        type: FinancialRecordType.EXPENSE,
        recordDate: new Date(),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 404 when parent matter not found', async () => {
    financialRecordRepository.findParentOwner.mockResolvedValue(null);

    await expect(
      useCase.execute(counsel, {
        title: 'Legal fee',
        amount: 1000,
        type: FinancialRecordType.EXPENSE,
        recordDate: new Date(),
        caseId: 'missing',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws 403 when counsel creates on another counsels case', async () => {
    financialRecordRepository.findParentOwner.mockResolvedValue({
      ownerId: otherCounsel.id,
    });

    await expect(
      useCase.execute(counsel, {
        title: 'Legal fee',
        amount: 1000,
        type: FinancialRecordType.EXPENSE,
        recordDate: new Date(),
        caseId: 'case-2',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws 403 when viewer tries to create', async () => {
    await expect(
      useCase.execute(viewer, {
        title: 'Legal fee',
        amount: 1000,
        type: FinancialRecordType.EXPENSE,
        recordDate: new Date(),
        caseId: 'case-1',
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('GetFinancialRecordUseCase', () => {
  let useCase: GetFinancialRecordUseCase;
  let financialRecordRepository: jest.Mocked<
    Pick<PrismaFinancialRecordRepository, 'findById'>
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

  const createdAt = new Date('2026-07-14T10:00:00.000Z');

  const record: FinancialRecordWithParent = {
    id: 'fr-1',
    title: 'Legal fee',
    amount: new Prisma.Decimal('1000.00'),
    currency: 'IRR',
    type: FinancialRecordType.EXPENSE,
    description: null,
    recordDate: new Date('2026-07-14T00:00:00.000Z'),
    caseId: 'case-1',
    contractId: null,
    createdById: counsel.id,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
    legalCase: { ownerId: counsel.id, deletedAt: null },
    contract: null,
  };

  beforeEach(() => {
    financialRecordRepository = {
      findById: jest.fn().mockResolvedValue(record),
    };

    useCase = new GetFinancialRecordUseCase(
      financialRecordRepository as unknown as PrismaFinancialRecordRepository,
      new AccessControlService(),
      createMockConfigService() as unknown as ConfigService,
    );
  });

  it('returns financial record for authorized user', async () => {
    const result = await useCase.execute(counsel, record.id);

    expect(result.data.id).toBe(record.id);
    expect(result.data.recordDatePersian).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });

  it('denies unauthorized counsel', async () => {
    await expect(useCase.execute(otherCounsel, record.id)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws when financial record not found', async () => {
    financialRecordRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(counsel, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('ListFinancialRecordsUseCase', () => {
  let useCase: ListFinancialRecordsUseCase;
  let financialRecordRepository: jest.Mocked<
    Pick<PrismaFinancialRecordRepository, 'list'>
  >;

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  const createdAt = new Date('2026-07-14T10:00:00.000Z');

  const records: FinancialRecordWithParent[] = [
    {
      id: 'fr-1',
      title: 'Legal fee',
      amount: new Prisma.Decimal('1000.00'),
      currency: 'IRR',
      type: FinancialRecordType.EXPENSE,
      description: null,
      recordDate: new Date('2026-07-14T00:00:00.000Z'),
      caseId: 'case-1',
      contractId: null,
      createdById: counsel.id,
      deletedAt: null,
      createdAt,
      updatedAt: createdAt,
      legalCase: { ownerId: counsel.id, deletedAt: null },
      contract: null,
    },
  ];

  beforeEach(() => {
    financialRecordRepository = {
      list: jest.fn().mockResolvedValue({ items: records, total: 1 }),
    };

    useCase = new ListFinancialRecordsUseCase(
      financialRecordRepository as unknown as PrismaFinancialRecordRepository,
      new AccessControlService(),
      createMockConfigService() as unknown as ConfigService,
    );
  });

  it('returns paginated financial records with counsel scope', async () => {
    const result = await useCase.execute(counsel, {
      caseId: 'case-1',
      page: 1,
      limit: 20,
    });

    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(financialRecordRepository.list).toHaveBeenCalledWith(
      {
        caseId: 'case-1',
        contractId: undefined,
        type: undefined,
        page: 1,
        limit: 20,
      },
      { ownerId: counsel.id },
    );
  });
});

describe('UpdateFinancialRecordUseCase', () => {
  let useCase: UpdateFinancialRecordUseCase;
  let financialRecordRepository: jest.Mocked<
    Pick<PrismaFinancialRecordRepository, 'findById' | 'update'>
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

  const createdAt = new Date('2026-07-14T10:00:00.000Z');

  const record: FinancialRecordWithParent = {
    id: 'fr-1',
    title: 'Legal fee',
    amount: new Prisma.Decimal('1000.00'),
    currency: 'IRR',
    type: FinancialRecordType.EXPENSE,
    description: null,
    recordDate: new Date('2026-07-14T00:00:00.000Z'),
    caseId: 'case-1',
    contractId: null,
    createdById: counsel.id,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
    legalCase: { ownerId: counsel.id, deletedAt: null },
    contract: null,
  };

  beforeEach(() => {
    financialRecordRepository = {
      findById: jest.fn().mockResolvedValue(record),
      update: jest.fn().mockResolvedValue({
        ...record,
        title: 'Updated fee',
      }),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new UpdateFinancialRecordUseCase(
      financialRecordRepository as unknown as PrismaFinancialRecordRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
      createMockConfigService() as unknown as ConfigService,
    );
  });

  it('updates financial record and logs activity for owner', async () => {
    const result = await useCase.execute(counsel, record.id, {
      title: 'Updated fee',
    });

    expect(result.data.title).toBe('Updated fee');
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATED,
        entityType: EntityType.FINANCIAL_RECORD,
        entityId: record.id,
        metadata: { fields: ['title'] },
      }),
    );
  });

  it('denies unauthorized counsel', async () => {
    await expect(
      useCase.execute(otherCounsel, record.id, { title: 'Updated fee' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when financial record not found', async () => {
    financialRecordRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(counsel, 'missing', { title: 'Updated fee' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('DeleteFinancialRecordUseCase', () => {
  let useCase: DeleteFinancialRecordUseCase;
  let financialRecordRepository: jest.Mocked<
    Pick<PrismaFinancialRecordRepository, 'findById' | 'softDelete'>
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

  const createdAt = new Date('2026-07-14T10:00:00.000Z');

  const record: FinancialRecordWithParent = {
    id: 'fr-1',
    title: 'Legal fee',
    amount: new Prisma.Decimal('1000.00'),
    currency: 'IRR',
    type: FinancialRecordType.EXPENSE,
    description: null,
    recordDate: new Date('2026-07-14T00:00:00.000Z'),
    caseId: 'case-1',
    contractId: null,
    createdById: counsel.id,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
    legalCase: { ownerId: counsel.id, deletedAt: null },
    contract: null,
  };

  beforeEach(() => {
    financialRecordRepository = {
      findById: jest.fn().mockResolvedValue(record),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new DeleteFinancialRecordUseCase(
      financialRecordRepository as unknown as PrismaFinancialRecordRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
    );
  });

  it('soft-deletes financial record and logs activity for owner', async () => {
    const result = await useCase.execute(counsel, record.id);

    expect(result.data).toEqual({ success: true });
    expect(financialRecordRepository.softDelete).toHaveBeenCalledWith(record.id);
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.DELETED,
        entityType: EntityType.FINANCIAL_RECORD,
        entityId: record.id,
      }),
    );
  });

  it('denies unauthorized counsel', async () => {
    await expect(useCase.execute(otherCounsel, record.id)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws when financial record not found', async () => {
    financialRecordRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(counsel, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
