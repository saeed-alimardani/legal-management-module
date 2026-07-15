import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaUserRepository } from '../../../src/modules/users/infrastructure/prisma-user.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';
import {
  cleanupTestUsers,
  deleteUserByEmail,
  disconnectTestPrisma,
  getUserIdByEmail,
  seedTestUsers,
  TEST_PASSWORD,
} from '../../helpers/db.helper';

describe('PrismaUserRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: PrismaUserRepository;

  const extraEmails = [
    'integration-user-create@legal.local',
    'integration-user-list@legal.local',
    'integration-user-update@legal.local',
  ];

  beforeAll(async () => {
    await seedTestUsers();

    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaUserRepository(prisma);
  });

  beforeEach(async () => {
    await cleanupTestUsers(extraEmails);
    for (const email of extraEmails) {
      await deleteUserByEmail(email);
    }
  });

  afterAll(async () => {
    await cleanupTestUsers(extraEmails);
    for (const email of extraEmails) {
      await deleteUserByEmail(email);
    }
    await prisma.$disconnect();
    await disconnectTestPrisma();
  });

  it('creates user returning safe fields only', async () => {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

    const created = await repository.create({
      email: 'integration-user-create@legal.local',
      passwordHash,
      fullName: 'Integration Create User',
      role: UserRole.LEGAL_COUNSEL,
    });

    expect(created.email).toBe('integration-user-create@legal.local');
    expect(created.fullName).toBe('Integration Create User');
    expect(created.role).toBe(UserRole.LEGAL_COUNSEL);
    expect(created.isActive).toBe(true);
    expect(created).not.toHaveProperty('passwordHash');
  });

  it('finds user by id without password hash', async () => {
    const ownerId = await getUserIdByEmail('counsel@legal.local');

    const user = await repository.findById(ownerId);

    expect(user).toEqual({
      id: ownerId,
      email: 'counsel@legal.local',
      fullName: 'Legal Counsel',
      role: UserRole.LEGAL_COUNSEL,
      isActive: true,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('finds user id by email', async () => {
    const ownerId = await getUserIdByEmail('manager@legal.local');

    const found = await repository.findByEmail('manager@legal.local');

    expect(found).toEqual({ id: ownerId });
  });

  it('returns null for unknown email', async () => {
    expect(await repository.findByEmail('nobody@legal.local')).toBeNull();
  });

  it('lists users with role filter', async () => {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    await repository.create({
      email: 'integration-user-list@legal.local',
      passwordHash,
      fullName: 'List Filter User',
      role: UserRole.VIEWER,
    });

    const viewers = await repository.list({
      role: UserRole.VIEWER,
      page: 1,
      limit: 20,
    });

    expect(viewers.total).toBeGreaterThanOrEqual(2);
    expect(
      viewers.items.every((user) => user.role === UserRole.VIEWER),
    ).toBe(true);
    expect(
      viewers.items.some(
        (user) => user.email === 'integration-user-list@legal.local',
      ),
    ).toBe(true);
  });

  it('lists users with isActive filter', async () => {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const created = await repository.create({
      email: 'integration-user-update@legal.local',
      passwordHash,
      fullName: 'Inactive Soon',
      role: UserRole.VIEWER,
    });

    await repository.update(created.id, { isActive: false });

    const inactive = await repository.list({
      isActive: false,
      page: 1,
      limit: 20,
    });

    expect(
      inactive.items.some(
        (user) => user.email === 'integration-user-update@legal.local',
      ),
    ).toBe(true);
    expect(inactive.items.every((user) => user.isActive === false)).toBe(true);

    const active = await repository.list({
      isActive: true,
      page: 1,
      limit: 20,
    });

    expect(
      active.items.some(
        (user) => user.email === 'integration-user-update@legal.local',
      ),
    ).toBe(false);
  });

  it('updates user fullName, role, and isActive', async () => {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const created = await repository.create({
      email: 'integration-user-update@legal.local',
      passwordHash,
      fullName: 'Before Update',
      role: UserRole.VIEWER,
    });

    const updated = await repository.update(created.id, {
      fullName: 'After Update',
      role: UserRole.LEGAL_MANAGER,
      isActive: false,
    });

    expect(updated.fullName).toBe('After Update');
    expect(updated.role).toBe(UserRole.LEGAL_MANAGER);
    expect(updated.isActive).toBe(false);
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      created.updatedAt.getTime(),
    );
  });
});
