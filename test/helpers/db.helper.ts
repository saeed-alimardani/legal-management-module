import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export const TEST_PASSWORD = 'Password123!';

const defaultUsers = [
  {
    email: 'admin@legal.local',
    fullName: 'Legal Admin',
    role: UserRole.LEGAL_ADMIN,
  },
  {
    email: 'manager@legal.local',
    fullName: 'Legal Manager',
    role: UserRole.LEGAL_MANAGER,
  },
  {
    email: 'counsel@legal.local',
    fullName: 'Legal Counsel',
    role: UserRole.LEGAL_COUNSEL,
  },
  {
    email: 'counsel2@legal.local',
    fullName: 'Legal Counsel Two',
    role: UserRole.LEGAL_COUNSEL,
  },
  {
    email: 'viewer@legal.local',
    fullName: 'Legal Viewer',
    role: UserRole.VIEWER,
  },
];

let prisma: PrismaClient | undefined;

export function getTestPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }

  return prisma;
}

export async function disconnectTestPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
  }
}

export async function seedTestUsers(): Promise<void> {
  const client = getTestPrisma();
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  for (const user of defaultUsers) {
    await client.user.upsert({
      where: { email: user.email },
      update: {
        fullName: user.fullName,
        role: user.role,
        passwordHash,
        isActive: true,
      },
      create: {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        passwordHash,
        isActive: true,
      },
    });
  }
}

export async function upsertInactiveUser(
  email = 'inactive@legal.local',
): Promise<void> {
  const client = getTestPrisma();
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  await client.user.upsert({
    where: { email },
    update: {
      fullName: 'Inactive User',
      role: UserRole.VIEWER,
      passwordHash,
      isActive: false,
    },
    create: {
      email,
      fullName: 'Inactive User',
      role: UserRole.VIEWER,
      passwordHash,
      isActive: false,
    },
  });
}

export async function deleteUserByEmail(email: string): Promise<void> {
  const client = getTestPrisma();
  await client.user.deleteMany({ where: { email } });
}

export async function getUserIdByEmail(email: string): Promise<string> {
  const client = getTestPrisma();
  const user = await client.user.findUniqueOrThrow({
    where: { email },
    select: { id: true },
  });

  return user.id;
}

export async function cleanupTestCases(): Promise<void> {
  const client = getTestPrisma();
  await client.activityLog.deleteMany({
    where: { entityType: 'CASE' },
  });
  await client.caseParty.deleteMany();
  await client.legalCase.deleteMany();
}
