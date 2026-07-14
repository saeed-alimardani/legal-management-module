import { PrismaClient, UserRole } from '@prisma/client';
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

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (const user of seedUsers) {
    await prisma.user.upsert({
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

  console.log(`Seeded ${seedUsers.length} users (password: ${DEFAULT_PASSWORD})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
