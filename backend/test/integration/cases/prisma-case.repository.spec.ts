import { CaseStatus, CaseType, PartyType, Priority } from '@prisma/client';
import { PrismaCaseRepository } from '../../../src/modules/cases/infrastructure/prisma-case.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';
import {
  cleanupTestCases,
  disconnectTestPrisma,
  getUserIdByEmail,
  seedTestUsers,
} from '../../helpers/db.helper';

describe('PrismaCaseRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: PrismaCaseRepository;
  let ownerId: string;
  let secondOwnerId: string;

  beforeAll(async () => {
    await seedTestUsers();
    ownerId = await getUserIdByEmail('counsel@legal.local');
    secondOwnerId = await getUserIdByEmail('counsel2@legal.local');

    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaCaseRepository(prisma);
  });

  beforeEach(async () => {
    await cleanupTestCases();
  });

  afterAll(async () => {
    await cleanupTestCases();
    await prisma.$disconnect();
    await disconnectTestPrisma();
  });

  it('generates sequential reference codes for the current year', async () => {
    const first = await repository.generateNextReferenceCode();
    const year = new Date().getFullYear();

    expect(first).toBe(`CASE-${year}-00001`);

    await repository.create({
      referenceCode: first,
      title: 'First Case',
      type: CaseType.LITIGATION,
      status: CaseStatus.OPEN,
      priority: Priority.HIGH,
      ownerId,
    });

    const second = await repository.generateNextReferenceCode();
    expect(second).toBe(`CASE-${year}-00002`);
  });

  it('creates case with nested parties', async () => {
    const referenceCode = await repository.generateNextReferenceCode();

    const created = await repository.create({
      referenceCode,
      title: 'Case With Parties',
      type: CaseType.ARBITRATION,
      status: CaseStatus.OPEN,
      priority: Priority.MEDIUM,
      ownerId,
      parties: [
        {
          name: 'Plaintiff Co',
          partyType: PartyType.PLAINTIFF,
          contactInfo: 'p@example.com',
        },
        {
          name: 'Defendant Co',
          partyType: PartyType.DEFENDANT,
        },
      ],
    });

    expect(created.parties).toHaveLength(2);
    expect(created.parties?.map((p) => p.name)).toEqual(
      expect.arrayContaining(['Plaintiff Co', 'Defendant Co']),
    );
  });

  it('lists only non-deleted cases and applies scope filter', async () => {
    const ref1 = await repository.generateNextReferenceCode();
    const owned = await repository.create({
      referenceCode: ref1,
      title: 'Owned Case',
      type: CaseType.LITIGATION,
      status: CaseStatus.OPEN,
      priority: Priority.HIGH,
      ownerId,
    });

    const ref2 = await repository.generateNextReferenceCode();
    await repository.create({
      referenceCode: ref2,
      title: 'Other Counsel Case',
      type: CaseType.INTERNAL,
      status: CaseStatus.OPEN,
      priority: Priority.LOW,
      ownerId: secondOwnerId,
    });

    const scoped = await repository.list({ page: 1, limit: 20 }, { ownerId });

    expect(scoped.total).toBe(1);
    expect(scoped.items[0].id).toBe(owned.id);

    const all = await repository.list({ page: 1, limit: 20 }, {});
    expect(all.total).toBe(2);
  });

  it('excludes soft-deleted cases from findById and list', async () => {
    const referenceCode = await repository.generateNextReferenceCode();
    const created = await repository.create({
      referenceCode,
      title: 'Delete Me',
      type: CaseType.OTHER,
      status: CaseStatus.OPEN,
      priority: Priority.LOW,
      ownerId,
    });

    await repository.softDelete(created.id);

    expect(await repository.findById(created.id)).toBeNull();

    const list = await repository.list({ page: 1, limit: 20 }, {});
    expect(list.total).toBe(0);

    const includingDeleted = await repository.findByIdIncludingDeleted(
      created.id,
    );
    expect(includingDeleted?.deletedAt).not.toBeNull();
  });

  it('filters list by status and type', async () => {
    const ref1 = await repository.generateNextReferenceCode();
    await repository.create({
      referenceCode: ref1,
      title: 'Open Litigation',
      type: CaseType.LITIGATION,
      status: CaseStatus.OPEN,
      priority: Priority.HIGH,
      ownerId,
    });

    const ref2 = await repository.generateNextReferenceCode();
    await repository.create({
      referenceCode: ref2,
      title: 'Closed Internal',
      type: CaseType.INTERNAL,
      status: CaseStatus.CLOSED,
      priority: Priority.LOW,
      ownerId,
    });

    const filtered = await repository.list(
      {
        page: 1,
        limit: 20,
        status: CaseStatus.OPEN,
        type: CaseType.LITIGATION,
      },
      {},
    );

    expect(filtered.total).toBe(1);
    expect(filtered.items[0].title).toBe('Open Litigation');
  });

  it('reassigns owner and adds parties independently', async () => {
    const referenceCode = await repository.generateNextReferenceCode();
    const created = await repository.create({
      referenceCode,
      title: 'Reassign Case',
      type: CaseType.REGULATORY,
      status: CaseStatus.IN_PROGRESS,
      priority: Priority.CRITICAL,
      ownerId,
    });

    const reassigned = await repository.reassign(created.id, secondOwnerId);
    expect(reassigned.ownerId).toBe(secondOwnerId);

    const party = await repository.addParty(created.id, {
      name: 'Regulator',
      partyType: PartyType.THIRD_PARTY,
    });

    const parties = await repository.listParties(created.id);
    expect(parties).toHaveLength(1);
    expect(parties[0].id).toBe(party.id);
  });

  it('validates active users exist', async () => {
    expect(await repository.userExistsAndActive(ownerId)).toBe(true);
    expect(
      await repository.userExistsAndActive(
        '00000000-0000-0000-0000-000000000000',
      ),
    ).toBe(false);
  });
});
