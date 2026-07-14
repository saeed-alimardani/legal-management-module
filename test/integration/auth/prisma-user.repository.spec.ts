import { UserRole } from '@prisma/client';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { PrismaUserRepository } from '../../../src/modules/auth/infrastructure/prisma-user.repository';
import {
  disconnectTestPrisma,
  getTestPrisma,
  seedTestUsers,
  TEST_PASSWORD,
  upsertInactiveUser,
} from '../../helpers/db.helper';

describe('PrismaUserRepository (integration)', () => {
  let repository: PrismaUserRepository;
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await seedTestUsers();
    repository = new PrismaUserRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await disconnectTestPrisma();
  });

  it('finds seeded user by email with password hash', async () => {
    const user = await repository.findByEmail('counsel@legal.local');

    expect(user).not.toBeNull();
    expect(user?.email).toBe('counsel@legal.local');
    expect(user?.role).toBe(UserRole.LEGAL_COUNSEL);
    expect(user?.passwordHash).toBeTruthy();
    expect(user?.isActive).toBe(true);
  });

  it('returns null for unknown email', async () => {
    const user = await repository.findByEmail('nobody@legal.local');
    expect(user).toBeNull();
  });

  it('finds active user by id without password hash in safe select', async () => {
    const dbUser = await getTestPrisma().user.findUnique({
      where: { email: 'admin@legal.local' },
    });

    const user = await repository.findActiveById(dbUser!.id);

    expect(user).toEqual({
      id: dbUser!.id,
      email: 'admin@legal.local',
      fullName: 'Legal Admin',
      role: UserRole.LEGAL_ADMIN,
      isActive: true,
    });
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('does not return inactive users from findActiveById', async () => {
    await upsertInactiveUser('inactive-integration@legal.local');

    const dbUser = await getTestPrisma().user.findUnique({
      where: { email: 'inactive-integration@legal.local' },
    });

    const user = await repository.findActiveById(dbUser!.id);
    expect(user).toBeNull();
  });

  it('returns all five seeded roles in database', async () => {
    const emails = [
      'admin@legal.local',
      'manager@legal.local',
      'counsel@legal.local',
      'counsel2@legal.local',
      'viewer@legal.local',
    ];

    const users = await Promise.all(
      emails.map((email) => repository.findByEmail(email)),
    );

    expect(users.every((user) => user !== null)).toBe(true);
    expect(users.map((user) => user!.role)).toEqual([
      UserRole.LEGAL_ADMIN,
      UserRole.LEGAL_MANAGER,
      UserRole.LEGAL_COUNSEL,
      UserRole.LEGAL_COUNSEL,
      UserRole.VIEWER,
    ]);
  });

  it('persists bcrypt password hash that matches TEST_PASSWORD', async () => {
    const bcrypt = await import('bcrypt');
    const user = await repository.findByEmail('viewer@legal.local');

    expect(await bcrypt.compare(TEST_PASSWORD, user!.passwordHash)).toBe(true);
  });
});
