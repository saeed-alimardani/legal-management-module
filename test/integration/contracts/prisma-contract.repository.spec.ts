import { ContractStatus, ContractType } from '@prisma/client';
import { PrismaContractRepository } from '../../../src/modules/contracts/infrastructure/prisma-contract.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';
import {
  cleanupTestContracts,
  disconnectTestPrisma,
  getUserIdByEmail,
  seedTestUsers,
  upsertInactiveUser,
  deleteUserByEmail,
} from '../../helpers/db.helper';

describe('PrismaContractRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: PrismaContractRepository;
  let ownerId: string;
  let secondOwnerId: string;

  beforeAll(async () => {
    await seedTestUsers();
    ownerId = await getUserIdByEmail('counsel@legal.local');
    secondOwnerId = await getUserIdByEmail('counsel2@legal.local');

    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaContractRepository(prisma);
  });

  beforeEach(async () => {
    await cleanupTestContracts();
  });

  afterAll(async () => {
    await cleanupTestContracts();
    await prisma.$disconnect();
    await disconnectTestPrisma();
  });

  it('generates sequential CTR reference codes for the current year', async () => {
    const first = await repository.generateNextReferenceCode();
    const year = new Date().getFullYear();

    expect(first).toBe(`CTR-${year}-00001`);

    await repository.create({
      referenceCode: first,
      title: 'First Contract',
      type: ContractType.MSA,
      status: ContractStatus.DRAFT,
      ownerId,
      counterpartyName: 'Acme',
    });

    const second = await repository.generateNextReferenceCode();
    expect(second).toBe(`CTR-${year}-00002`);
  });

  it('creates contract with date fields persisted as UTC dates', async () => {
    const referenceCode = await repository.generateNextReferenceCode();

    const created = await repository.create({
      referenceCode,
      title: 'Dated MSA',
      type: ContractType.MSA,
      status: ContractStatus.ACTIVE,
      ownerId,
      counterpartyName: 'Acme Corp',
      effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
      expirationDate: new Date('2026-12-31T00:00:00.000Z'),
      renewalDate: new Date('2026-11-01T00:00:00.000Z'),
      keyTerms: 'Net 30',
    });

    expect(created.counterpartyName).toBe('Acme Corp');
    expect(created.effectiveDate?.toISOString().slice(0, 10)).toBe(
      '2026-01-01',
    );
    expect(created.expirationDate?.toISOString().slice(0, 10)).toBe(
      '2026-12-31',
    );
    expect(created.keyTerms).toBe('Net 30');
  });

  it('lists only non-deleted contracts and applies owner scope', async () => {
    const ref1 = await repository.generateNextReferenceCode();
    const owned = await repository.create({
      referenceCode: ref1,
      title: 'Owned',
      type: ContractType.NDA,
      status: ContractStatus.DRAFT,
      ownerId,
      counterpartyName: 'A',
    });

    const ref2 = await repository.generateNextReferenceCode();
    await repository.create({
      referenceCode: ref2,
      title: 'Other',
      type: ContractType.NDA,
      status: ContractStatus.DRAFT,
      ownerId: secondOwnerId,
      counterpartyName: 'B',
    });

    const scoped = await repository.list({ page: 1, limit: 20 }, { ownerId });
    expect(scoped.total).toBe(1);
    expect(scoped.items[0].id).toBe(owned.id);

    const all = await repository.list({ page: 1, limit: 20 }, {});
    expect(all.total).toBe(2);
  });

  it('excludes soft-deleted contracts from findById and list', async () => {
    const referenceCode = await repository.generateNextReferenceCode();
    const created = await repository.create({
      referenceCode,
      title: 'Delete Me',
      type: ContractType.OTHER,
      status: ContractStatus.TERMINATED,
      ownerId,
      counterpartyName: 'Gone',
    });

    await repository.softDelete(created.id);

    expect(await repository.findById(created.id)).toBeNull();

    const list = await repository.list({ page: 1, limit: 20 }, {});
    expect(list.total).toBe(0);
  });

  it('filters list by status and type', async () => {
    const ref1 = await repository.generateNextReferenceCode();
    await repository.create({
      referenceCode: ref1,
      title: 'Active MSA',
      type: ContractType.MSA,
      status: ContractStatus.ACTIVE,
      ownerId,
      counterpartyName: 'A',
    });

    const ref2 = await repository.generateNextReferenceCode();
    await repository.create({
      referenceCode: ref2,
      title: 'Draft NDA',
      type: ContractType.NDA,
      status: ContractStatus.DRAFT,
      ownerId,
      counterpartyName: 'B',
    });

    const filtered = await repository.list(
      {
        page: 1,
        limit: 20,
        status: ContractStatus.ACTIVE,
        type: ContractType.MSA,
      },
      {},
    );

    expect(filtered.total).toBe(1);
    expect(filtered.items[0].title).toBe('Active MSA');
  });

  it('updates fields and reassigns owner', async () => {
    const referenceCode = await repository.generateNextReferenceCode();
    const created = await repository.create({
      referenceCode,
      title: 'Update Me',
      type: ContractType.VENDOR,
      status: ContractStatus.UNDER_REVIEW,
      ownerId,
      counterpartyName: 'Vendor',
    });

    const updated = await repository.update(created.id, {
      title: 'Updated Title',
      status: ContractStatus.ACTIVE,
      keyTerms: 'Updated terms',
    });

    expect(updated.title).toBe('Updated Title');
    expect(updated.status).toBe(ContractStatus.ACTIVE);
    expect(updated.keyTerms).toBe('Updated terms');

    const reassigned = await repository.reassign(created.id, secondOwnerId);
    expect(reassigned.ownerId).toBe(secondOwnerId);
  });

  it('validates active users exist', async () => {
    expect(await repository.userExistsAndActive(ownerId)).toBe(true);
    expect(
      await repository.userExistsAndActive(
        '00000000-0000-0000-0000-000000000000',
      ),
    ).toBe(false);

    await upsertInactiveUser();
    const inactiveId = await getUserIdByEmail('inactive@legal.local');
    expect(await repository.userExistsAndActive(inactiveId)).toBe(false);
    await deleteUserByEmail('inactive@legal.local');
  });
});
