import {
  CaseStatus,
  CaseType,
  PartyType,
  PrismaClient,
  Priority,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Password123!';

const seedUsers = [
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

interface SeedCaseInput {
  referenceCode: string;
  title: string;
  type: CaseType;
  status: CaseStatus;
  priority: Priority;
  ownerEmail: string;
  description?: string;
  openedDate?: Date;
  closedDate?: Date;
  parties: Array<{
    name: string;
    partyType: PartyType;
    contactInfo?: string;
    notes?: string;
  }>;
}

const seedCases: SeedCaseInput[] = [
  {
    referenceCode: 'CASE-2026-00001',
    title: 'Dispute with Vendor X',
    type: CaseType.LITIGATION,
    status: CaseStatus.OPEN,
    priority: Priority.HIGH,
    ownerEmail: 'counsel@legal.local',
    description:
      'Commercial dispute regarding delivery terms and service-level breaches.',
    openedDate: new Date('2026-01-10'),
    parties: [
      {
        name: 'Our Company',
        partyType: PartyType.PLAINTIFF,
        contactInfo: 'legal@company.com',
      },
      {
        name: 'Vendor X',
        partyType: PartyType.DEFENDANT,
        contactInfo: 'disputes@vendorx.com',
        notes: 'Primary counterparty in delivery dispute',
      },
    ],
  },
  {
    referenceCode: 'CASE-2026-00002',
    title: 'Data Protection Inquiry',
    type: CaseType.REGULATORY,
    status: CaseStatus.IN_PROGRESS,
    priority: Priority.CRITICAL,
    ownerEmail: 'counsel@legal.local',
    description: 'Regulatory inquiry into data handling and retention practices.',
    openedDate: new Date('2026-02-01'),
    parties: [
      {
        name: 'Data Protection Authority',
        partyType: PartyType.THIRD_PARTY,
        contactInfo: 'inquiries@dpa.gov',
      },
    ],
  },
  {
    referenceCode: 'CASE-2026-00003',
    title: 'Internal Policy Review',
    type: CaseType.INTERNAL,
    status: CaseStatus.CLOSED,
    priority: Priority.LOW,
    ownerEmail: 'counsel2@legal.local',
    description: 'Closed internal review of whistleblower policy updates.',
    openedDate: new Date('2025-11-01'),
    closedDate: new Date('2026-01-31'),
    parties: [
      {
        name: 'HR Department',
        partyType: PartyType.INTERNAL,
        contactInfo: 'hr@company.com',
      },
    ],
  },
];

async function seedUsersData(passwordHash: string): Promise<Map<string, string>> {
  const userIds = new Map<string, string>();

  for (const user of seedUsers) {
    const record = await prisma.user.upsert({
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

    userIds.set(user.email, record.id);
  }

  return userIds;
}

async function upsertCaseWithParties(
  seedCase: SeedCaseInput,
  ownerId: string,
): Promise<void> {
  const legalCase = await prisma.legalCase.upsert({
    where: { referenceCode: seedCase.referenceCode },
    update: {
      title: seedCase.title,
      type: seedCase.type,
      status: seedCase.status,
      priority: seedCase.priority,
      ownerId,
      description: seedCase.description ?? null,
      openedDate: seedCase.openedDate ?? null,
      closedDate: seedCase.closedDate ?? null,
      deletedAt: null,
    },
    create: {
      referenceCode: seedCase.referenceCode,
      title: seedCase.title,
      type: seedCase.type,
      status: seedCase.status,
      priority: seedCase.priority,
      ownerId,
      description: seedCase.description ?? null,
      openedDate: seedCase.openedDate ?? null,
      closedDate: seedCase.closedDate ?? null,
    },
  });

  await prisma.caseParty.deleteMany({ where: { caseId: legalCase.id } });

  if (seedCase.parties.length > 0) {
    await prisma.caseParty.createMany({
      data: seedCase.parties.map((party) => ({
        caseId: legalCase.id,
        name: party.name,
        partyType: party.partyType,
        contactInfo: party.contactInfo ?? null,
        notes: party.notes ?? null,
      })),
    });
  }
}

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const userIds = await seedUsersData(passwordHash);

  for (const seedCase of seedCases) {
    const ownerId = userIds.get(seedCase.ownerEmail);

    if (!ownerId) {
      throw new Error(`Owner not found for case ${seedCase.referenceCode}`);
    }

    await upsertCaseWithParties(seedCase, ownerId);
  }

  const partyCount = seedCases.reduce(
    (total, seedCase) => total + seedCase.parties.length,
    0,
  );

  console.log(`Seeded ${seedUsers.length} users (password: ${DEFAULT_PASSWORD})`);
  console.log(
    `Seeded ${seedCases.length} cases with ${partyCount} parties`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
