import {
  CaseStatus,
  CaseType,
  ContractStatus,
  ContractType,
  FinancialRecordType,
  Prisma,
  Priority,
} from '@prisma/client';
import { PrismaFinancialRecordRepository } from '../../../src/modules/financial-records/infrastructure/prisma-financial-record.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';
import {
  cleanupTestCases,
  cleanupTestContracts,
  cleanupTestFinancialRecords,
  disconnectTestPrisma,
  getUserIdByEmail,
  seedTestUsers,
} from '../../helpers/db.helper';

describe('PrismaFinancialRecordRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: PrismaFinancialRecordRepository;
  let ownerId: string;
  let secondOwnerId: string;
  let caseId: string;
  let otherCaseId: string;
  let contractId: string;

  beforeAll(async () => {
    await seedTestUsers();
    ownerId = await getUserIdByEmail('counsel@legal.local');
    secondOwnerId = await getUserIdByEmail('counsel2@legal.local');

    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaFinancialRecordRepository(prisma);
  });

  beforeEach(async () => {
    await cleanupTestFinancialRecords();
    await cleanupTestContracts();
    await cleanupTestCases();

    const ts = Date.now();

    const ownedCase = await prisma.legalCase.create({
      data: {
        referenceCode: `CASE-FIN-${ts}`,
        title: 'Financial Parent Case',
        type: CaseType.LITIGATION,
        status: CaseStatus.OPEN,
        priority: Priority.HIGH,
        ownerId,
      },
    });
    caseId = ownedCase.id;

    const otherCase = await prisma.legalCase.create({
      data: {
        referenceCode: `CASE-FIN-OTHER-${ts}`,
        title: 'Other Counsel Financial Case',
        type: CaseType.INTERNAL,
        status: CaseStatus.OPEN,
        priority: Priority.LOW,
        ownerId: secondOwnerId,
      },
    });
    otherCaseId = otherCase.id;

    const contract = await prisma.contract.create({
      data: {
        referenceCode: `CTR-FIN-${ts}`,
        title: 'Financial Parent Contract',
        type: ContractType.MSA,
        status: ContractStatus.ACTIVE,
        ownerId,
        counterpartyName: 'Acme',
      },
    });
    contractId = contract.id;
  });

  afterAll(async () => {
    await cleanupTestFinancialRecords();
    await cleanupTestContracts();
    await cleanupTestCases();
    await prisma.$disconnect();
    await disconnectTestPrisma();
  });

  it('creates financial record on case', async () => {
    const created = await repository.create({
      title: 'Court filing fee',
      amount: new Prisma.Decimal('1500000.00'),
      currency: 'IRR',
      type: FinancialRecordType.EXPENSE,
      description: 'Filing costs',
      recordDate: new Date('2026-07-01T00:00:00.000Z'),
      caseId,
      createdById: ownerId,
    });

    expect(created.title).toBe('Court filing fee');
    expect(created.amount.toString()).toBe('1500000');
    expect(created.caseId).toBe(caseId);
    expect(created.legalCase?.ownerId).toBe(ownerId);
    expect(created.deletedAt).toBeNull();
  });

  it('finds financial record by id', async () => {
    const created = await repository.create({
      title: 'Retainer payment',
      amount: new Prisma.Decimal('5000000.00'),
      currency: 'IRR',
      type: FinancialRecordType.PAYMENT,
      recordDate: new Date('2026-06-15T00:00:00.000Z'),
      contractId,
      createdById: ownerId,
    });

    const found = await repository.findById(created.id);

    expect(found?.id).toBe(created.id);
    expect(found?.contract?.ownerId).toBe(ownerId);
  });

  it('excludes soft-deleted records from findById and list', async () => {
    const created = await repository.create({
      title: 'Delete me',
      amount: new Prisma.Decimal('100.00'),
      currency: 'IRR',
      type: FinancialRecordType.OTHER,
      recordDate: new Date('2026-07-10T00:00:00.000Z'),
      caseId,
      createdById: ownerId,
    });

    await repository.softDelete(created.id);

    expect(await repository.findById(created.id)).toBeNull();

    const list = await repository.list({ page: 1, limit: 20 }, {});
    expect(list.total).toBe(0);
  });

  it('lists records ordered by recordDate desc', async () => {
    await repository.create({
      title: 'Older',
      amount: new Prisma.Decimal('100.00'),
      currency: 'IRR',
      type: FinancialRecordType.EXPENSE,
      recordDate: new Date('2026-06-01T00:00:00.000Z'),
      caseId,
      createdById: ownerId,
    });
    await repository.create({
      title: 'Newer',
      amount: new Prisma.Decimal('200.00'),
      currency: 'IRR',
      type: FinancialRecordType.INVOICE,
      recordDate: new Date('2026-07-01T00:00:00.000Z'),
      caseId,
      createdById: ownerId,
    });

    const list = await repository.list({ page: 1, limit: 20 }, {});

    expect(list.total).toBe(2);
    expect(list.items.map((item) => item.title)).toEqual(['Newer', 'Older']);
  });

  it('scopes list to records on entities owned by counsel', async () => {
    await repository.create({
      title: 'Owned case expense',
      amount: new Prisma.Decimal('300.00'),
      currency: 'IRR',
      type: FinancialRecordType.EXPENSE,
      recordDate: new Date('2026-07-05T00:00:00.000Z'),
      caseId,
      createdById: ownerId,
    });
    await repository.create({
      title: 'Other counsel expense',
      amount: new Prisma.Decimal('400.00'),
      currency: 'IRR',
      type: FinancialRecordType.EXPENSE,
      recordDate: new Date('2026-07-06T00:00:00.000Z'),
      caseId: otherCaseId,
      createdById: secondOwnerId,
    });

    const scoped = await repository.list({ page: 1, limit: 20 }, { ownerId });
    expect(scoped.total).toBe(1);
    expect(scoped.items[0].title).toBe('Owned case expense');

    const all = await repository.list({ page: 1, limit: 20 }, {});
    expect(all.total).toBe(2);
  });

  it('filters list by caseId and type', async () => {
    await repository.create({
      title: 'Case expense',
      amount: new Prisma.Decimal('100.00'),
      currency: 'IRR',
      type: FinancialRecordType.EXPENSE,
      recordDate: new Date('2026-07-01T00:00:00.000Z'),
      caseId,
      createdById: ownerId,
    });
    await repository.create({
      title: 'Contract invoice',
      amount: new Prisma.Decimal('200.00'),
      currency: 'IRR',
      type: FinancialRecordType.INVOICE,
      recordDate: new Date('2026-07-02T00:00:00.000Z'),
      contractId,
      createdById: ownerId,
    });

    const filtered = await repository.list(
      {
        caseId,
        type: FinancialRecordType.EXPENSE,
        page: 1,
        limit: 20,
      },
      {},
    );

    expect(filtered.total).toBe(1);
    expect(filtered.items[0].title).toBe('Case expense');
  });

  it('updates financial record fields', async () => {
    const created = await repository.create({
      title: 'Original title',
      amount: new Prisma.Decimal('1000.00'),
      currency: 'IRR',
      type: FinancialRecordType.EXPENSE,
      recordDate: new Date('2026-07-01T00:00:00.000Z'),
      caseId,
      createdById: ownerId,
    });

    const updated = await repository.update(created.id, {
      title: 'Updated title',
      amount: new Prisma.Decimal('2500.50'),
      type: FinancialRecordType.PAYMENT,
      description: 'Adjusted amount',
    });

    expect(updated.title).toBe('Updated title');
    expect(updated.amount.toString()).toBe('2500.5');
    expect(updated.type).toBe(FinancialRecordType.PAYMENT);
    expect(updated.description).toBe('Adjusted amount');
  });

  it('soft-deletes financial record', async () => {
    const created = await repository.create({
      title: 'Soft delete target',
      amount: new Prisma.Decimal('99.00'),
      currency: 'IRR',
      type: FinancialRecordType.OTHER,
      recordDate: new Date('2026-07-14T00:00:00.000Z'),
      caseId,
      createdById: ownerId,
    });

    const deleted = await repository.softDelete(created.id);

    expect(deleted.deletedAt).not.toBeNull();
  });

});
