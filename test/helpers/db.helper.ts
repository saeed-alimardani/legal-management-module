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

export async function cleanupTestTasks(): Promise<void> {
  const client = getTestPrisma();
  await client.activityLog.deleteMany({
    where: { entityType: 'TASK' },
  });
  await client.task.deleteMany();
}

export async function cleanupTestDocuments(): Promise<void> {
  const client = getTestPrisma();
  await client.activityLog.deleteMany({
    where: { entityType: 'DOCUMENT' },
  });
  await client.document.deleteMany();
}

export async function cleanupTestCases(): Promise<void> {
  const client = getTestPrisma();
  await client.activityLog.deleteMany({
    where: { entityType: 'CASE' },
  });
  // Delete children first — ON DELETE SET NULL would violate single-parent CHECK
  await client.deadline.deleteMany({
    where: { caseId: { not: null } },
  });
  await client.task.deleteMany({
    where: { caseId: { not: null } },
  });
  await client.document.deleteMany({
    where: { caseId: { not: null } },
  });
  await client.legalNotice.updateMany({
    where: { relatedCaseId: { not: null } },
    data: { relatedCaseId: null },
  });
  await client.caseParty.deleteMany();
  await client.legalCase.deleteMany();
}

export async function cleanupTestDeadlines(): Promise<void> {
  const client = getTestPrisma();
  await client.activityLog.deleteMany({
    where: { entityType: 'DEADLINE' },
  });
  await client.deadline.deleteMany();
}

export async function cleanupTestContracts(): Promise<void> {
  const client = getTestPrisma();
  await client.activityLog.deleteMany({
    where: { entityType: 'CONTRACT' },
  });
  await client.deadline.deleteMany({
    where: { contractId: { not: null } },
  });
  await client.task.deleteMany({
    where: { contractId: { not: null } },
  });
  await client.document.deleteMany({
    where: { contractId: { not: null } },
  });
  await client.legalNotice.updateMany({
    where: { relatedContractId: { not: null } },
    data: { relatedContractId: null },
  });
  await client.contract.deleteMany();
}

export async function cleanupTestNotices(): Promise<void> {
  const client = getTestPrisma();
  await client.activityLog.deleteMany({
    where: {
      OR: [{ entityType: 'NOTICE' }, { entityType: 'DEADLINE' }],
    },
  });
  await client.deadline.deleteMany({
    where: { noticeId: { not: null } },
  });
  await client.task.deleteMany({
    where: { noticeId: { not: null } },
  });
  await client.document.deleteMany({
    where: { noticeId: { not: null } },
  });
  await client.legalNotice.deleteMany();
}
