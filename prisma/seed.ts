import {
  AuditAction,
  CaseStatus,
  CaseType,
  ContractStatus,
  ContractType,
  DeadlineStatus,
  DocumentType,
  EntityType,
  FinancialRecordType,
  NoticeStatus,
  PartyType,
  Prisma,
  PrismaClient,
  Priority,
  ReminderStatus,
  TaskStatus,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  todayInTimezone,
  toUtcDateOnly,
} from '../src/shared/utils/date-boundary.util';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Password123!';
const APP_TIMEZONE = process.env.APP_TIMEZONE ?? 'Asia/Tehran';
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads';

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

function addDaysFromToday(offset: number): Date {
  const today = todayInTimezone(APP_TIMEZONE);
  const shifted = new Date(today);
  shifted.setUTCDate(shifted.getUTCDate() + offset);
  return toUtcDateOnly(shifted);
}

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
): Promise<string> {
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

  return legalCase.id;
}

async function seedContracts(
  userIds: Map<string, string>,
): Promise<Map<string, string>> {
  const contractIds = new Map<string, string>();
  const counselId = userIds.get('counsel@legal.local')!;

  const contracts = [
    {
      referenceCode: 'CTR-2026-00001',
      title: 'Master Services Agreement — Acme Corp',
      type: ContractType.MSA,
      status: ContractStatus.ACTIVE,
      counterpartyName: 'Acme Corp',
      effectiveDate: new Date('2025-06-01'),
      expirationDate: addDaysFromToday(90),
      keyTerms: 'Annual renewal with 90-day notice period.',
    },
    {
      referenceCode: 'CTR-2026-00002',
      title: 'Mutual NDA — Beta LLC',
      type: ContractType.NDA,
      status: ContractStatus.DRAFT,
      counterpartyName: 'Beta LLC',
      keyTerms: 'Standard mutual confidentiality terms.',
    },
  ];

  for (const contract of contracts) {
    const record = await prisma.contract.upsert({
      where: { referenceCode: contract.referenceCode },
      update: {
        title: contract.title,
        type: contract.type,
        status: contract.status,
        ownerId: counselId,
        counterpartyName: contract.counterpartyName,
        effectiveDate: contract.effectiveDate ?? null,
        expirationDate: contract.expirationDate ?? null,
        renewalDate: null,
        keyTerms: contract.keyTerms ?? null,
        deletedAt: null,
      },
      create: {
        referenceCode: contract.referenceCode,
        title: contract.title,
        type: contract.type,
        status: contract.status,
        ownerId: counselId,
        counterpartyName: contract.counterpartyName,
        effectiveDate: contract.effectiveDate ?? null,
        expirationDate: contract.expirationDate ?? null,
        keyTerms: contract.keyTerms ?? null,
      },
    });

    contractIds.set(contract.referenceCode, record.id);
  }

  return contractIds;
}

async function upsertNoticeWithDeadline(input: {
  referenceCode: string;
  title: string;
  sender: string;
  receivedDate: Date;
  responseDeadline: Date;
  status: NoticeStatus;
  ownerId: string;
  createdById: string;
  description?: string;
  relatedCaseId?: string;
  relatedContractId?: string;
}): Promise<string> {
  const notice = await prisma.legalNotice.upsert({
    where: { referenceCode: input.referenceCode },
    update: {
      title: input.title,
      sender: input.sender,
      receivedDate: input.receivedDate,
      responseDeadline: input.responseDeadline,
      status: input.status,
      ownerId: input.ownerId,
      description: input.description ?? null,
      relatedCaseId: input.relatedCaseId ?? null,
      relatedContractId: input.relatedContractId ?? null,
      deletedAt: null,
    },
    create: {
      referenceCode: input.referenceCode,
      title: input.title,
      sender: input.sender,
      receivedDate: input.receivedDate,
      responseDeadline: input.responseDeadline,
      status: input.status,
      ownerId: input.ownerId,
      description: input.description ?? null,
      relatedCaseId: input.relatedCaseId ?? null,
      relatedContractId: input.relatedContractId ?? null,
    },
  });

  const existingDeadline = await prisma.deadline.findFirst({
    where: { noticeId: notice.id },
    select: { id: true },
  });

  const deadlineData = {
    title: `Response deadline: ${notice.title}`,
    dueDate: input.responseDeadline,
    status: DeadlineStatus.PENDING,
    assigneeId: input.ownerId,
    noticeId: notice.id,
    createdById: input.createdById,
    caseId: null,
    contractId: null,
  };

  if (existingDeadline) {
    await prisma.deadline.update({
      where: { id: existingDeadline.id },
      data: deadlineData,
    });
  } else {
    await prisma.deadline.create({ data: deadlineData });
  }

  return notice.id;
}

async function upsertStandaloneDeadline(input: {
  title: string;
  dueDate: Date;
  assigneeId: string;
  createdById: string;
  caseId?: string;
  contractId?: string;
}): Promise<void> {
  const existing = await prisma.deadline.findFirst({
    where: {
      title: input.title,
      caseId: input.caseId ?? null,
      contractId: input.contractId ?? null,
      noticeId: null,
    },
    select: { id: true },
  });

  const data = {
    title: input.title,
    dueDate: input.dueDate,
    status: DeadlineStatus.PENDING,
    assigneeId: input.assigneeId,
    createdById: input.createdById,
    caseId: input.caseId ?? null,
    contractId: input.contractId ?? null,
    noticeId: null,
  };

  if (existing) {
    await prisma.deadline.update({ where: { id: existing.id }, data });
  } else {
    await prisma.deadline.create({ data });
  }
}

async function seedDeadlinesAndNotices(
  userIds: Map<string, string>,
  caseIds: Map<string, string>,
  contractIds: Map<string, string>,
): Promise<Map<string, string>> {
  const noticeIds = new Map<string, string>();
  const counselId = userIds.get('counsel@legal.local')!;
  const counsel2Id = userIds.get('counsel2@legal.local')!;
  const managerId = userIds.get('manager@legal.local')!;
  const adminId = userIds.get('admin@legal.local')!;

  const case1Id = caseIds.get('CASE-2026-00001')!;
  const case2Id = caseIds.get('CASE-2026-00002')!;
  const contract1Id = contractIds.get('CTR-2026-00001')!;

  const notice1Id = await upsertNoticeWithDeadline({
    referenceCode: 'NTC-2026-00001',
    title: 'Regulatory Response Notice — Vendor X',
    sender: 'Vendor X Legal',
    receivedDate: addDaysFromToday(-2),
    responseDeadline: addDaysFromToday(5),
    status: NoticeStatus.RECEIVED,
    ownerId: counselId,
    createdById: adminId,
    description: 'Formal notice requiring response within statutory window.',
    relatedCaseId: case1Id,
  });
  noticeIds.set('NTC-2026-00001', notice1Id);

  const notice2Id = await upsertNoticeWithDeadline({
    referenceCode: 'NTC-2026-00002',
    title: 'Overdue Compliance Notice',
    sender: 'Compliance Board',
    receivedDate: addDaysFromToday(-20),
    responseDeadline: addDaysFromToday(-7),
    status: NoticeStatus.OVERDUE,
    ownerId: counselId,
    createdById: managerId,
    description: 'Past-due notice kept open for dashboard overdue demo.',
  });
  noticeIds.set('NTC-2026-00002', notice2Id);

  await upsertStandaloneDeadline({
    title: 'Case hearing preparation',
    dueDate: addDaysFromToday(-3),
    assigneeId: counselId,
    createdById: adminId,
    caseId: case1Id,
  });

  await upsertStandaloneDeadline({
    title: 'Contract renewal review',
    dueDate: addDaysFromToday(0),
    assigneeId: managerId,
    createdById: adminId,
    contractId: contract1Id,
  });

  await upsertStandaloneDeadline({
    title: 'Regulatory filing submission',
    dueDate: addDaysFromToday(0),
    assigneeId: counsel2Id,
    createdById: managerId,
    caseId: case2Id,
  });

  await upsertStandaloneDeadline({
    title: 'Contract filing follow-up',
    dueDate: addDaysFromToday(14),
    assigneeId: counselId,
    createdById: managerId,
    contractId: contract1Id,
  });

  return noticeIds;
}

async function seedTasks(
  userIds: Map<string, string>,
  caseIds: Map<string, string>,
  contractIds: Map<string, string>,
  noticeIds: Map<string, string>,
): Promise<void> {
  const counselId = userIds.get('counsel@legal.local')!;
  const managerId = userIds.get('manager@legal.local')!;
  const case1Id = caseIds.get('CASE-2026-00001')!;
  const contract1Id = contractIds.get('CTR-2026-00001')!;
  const notice1Id = noticeIds.get('NTC-2026-00001')!;

  const parentIds = [case1Id, contract1Id, notice1Id];
  await prisma.task.deleteMany({
    where: {
      OR: [
        { caseId: { in: parentIds } },
        { contractId: { in: parentIds } },
        { noticeId: { in: parentIds } },
      ],
    },
  });

  await prisma.task.createMany({
    data: [
      {
        title: 'Draft initial response',
        description: 'Prepare first response to vendor dispute.',
        status: TaskStatus.DONE,
        assigneeId: counselId,
        caseId: case1Id,
        createdById: managerId,
        completedAt: new Date(),
      },
      {
        title: 'Collect supporting evidence',
        description: 'Gather delivery logs and SLA reports.',
        status: TaskStatus.TODO,
        assigneeId: counselId,
        caseId: case1Id,
        createdById: managerId,
      },
      {
        title: 'Review renewal clauses',
        status: TaskStatus.IN_PROGRESS,
        assigneeId: counselId,
        contractId: contract1Id,
        createdById: managerId,
      },
      {
        title: 'Coordinate notice response',
        status: TaskStatus.TODO,
        assigneeId: counselId,
        noticeId: notice1Id,
        createdById: managerId,
      },
    ],
  });
}

async function seedDocuments(
  userIds: Map<string, string>,
  caseIds: Map<string, string>,
  contractIds: Map<string, string>,
  noticeIds: Map<string, string>,
): Promise<void> {
  const counselId = userIds.get('counsel@legal.local')!;
  const case1Id = caseIds.get('CASE-2026-00001')!;
  const contract1Id = contractIds.get('CTR-2026-00001')!;
  const notice1Id = noticeIds.get('NTC-2026-00001')!;

  await mkdir(UPLOAD_DIR, { recursive: true });

  const documents = [
    {
      storageKey: 'seed-case-evidence.pdf',
      fileName: 'vendor-dispute-evidence.pdf',
      mimeType: 'application/pdf',
      fileSize: 128,
      documentType: DocumentType.EVIDENCE,
      description: 'Delivery dispute supporting evidence',
      caseId: case1Id,
    },
    {
      storageKey: 'seed-contract-msa.pdf',
      fileName: 'acme-msa-signed.pdf',
      mimeType: 'application/pdf',
      fileSize: 256,
      documentType: DocumentType.CONTRACT,
      description: 'Executed MSA with Acme Corp',
      contractId: contract1Id,
    },
    {
      storageKey: 'seed-notice-scan.pdf',
      fileName: 'regulatory-notice-scan.pdf',
      mimeType: 'application/pdf',
      fileSize: 192,
      documentType: DocumentType.CORRESPONDENCE,
      description: 'Scanned copy of received notice',
      noticeId: notice1Id,
    },
  ];

  for (const doc of documents) {
    const filePath = join(UPLOAD_DIR, doc.storageKey);
    await writeFile(filePath, `%PDF-1.4 seed placeholder for ${doc.fileName}\n`);

    await prisma.document.upsert({
      where: { storageKey: doc.storageKey },
      update: {
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        documentType: doc.documentType,
        description: doc.description,
        uploadedById: counselId,
        caseId: doc.caseId ?? null,
        contractId: doc.contractId ?? null,
        noticeId: doc.noticeId ?? null,
        deletedAt: null,
      },
      create: {
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        storageKey: doc.storageKey,
        documentType: doc.documentType,
        description: doc.description,
        uploadedById: counselId,
        caseId: doc.caseId ?? null,
        contractId: doc.contractId ?? null,
        noticeId: doc.noticeId ?? null,
      },
    });
  }
}

async function seedActivityLogs(
  userIds: Map<string, string>,
  caseIds: Map<string, string>,
  contractIds: Map<string, string>,
  noticeIds: Map<string, string>,
): Promise<void> {
  const adminId = userIds.get('admin@legal.local')!;
  const managerId = userIds.get('manager@legal.local')!;
  const counselId = userIds.get('counsel@legal.local')!;

  const entityIds = [
    caseIds.get('CASE-2026-00001')!,
    caseIds.get('CASE-2026-00002')!,
    contractIds.get('CTR-2026-00001')!,
    noticeIds.get('NTC-2026-00001')!,
  ];

  await prisma.activityLog.deleteMany({
    where: { entityId: { in: entityIds } },
  });

  const logs = [
    {
      actorId: adminId,
      action: AuditAction.CREATED,
      entityType: EntityType.CASE,
      entityId: caseIds.get('CASE-2026-00001')!,
      metadata: { referenceCode: 'CASE-2026-00001', title: 'Dispute with Vendor X' },
    },
    {
      actorId: managerId,
      action: AuditAction.UPDATED,
      entityType: EntityType.CASE,
      entityId: caseIds.get('CASE-2026-00001')!,
      metadata: { fields: ['priority'], previousPriority: 'MEDIUM' },
    },
    {
      actorId: counselId,
      action: AuditAction.STATUS_CHANGED,
      entityType: EntityType.CASE,
      entityId: caseIds.get('CASE-2026-00002')!,
      metadata: { from: 'OPEN', to: 'IN_PROGRESS' },
    },
    {
      actorId: adminId,
      action: AuditAction.CREATED,
      entityType: EntityType.CONTRACT,
      entityId: contractIds.get('CTR-2026-00001')!,
      metadata: { referenceCode: 'CTR-2026-00001' },
    },
    {
      actorId: managerId,
      action: AuditAction.CREATED,
      entityType: EntityType.NOTICE,
      entityId: noticeIds.get('NTC-2026-00001')!,
      metadata: { referenceCode: 'NTC-2026-00001' },
    },
    {
      actorId: counselId,
      action: AuditAction.DOCUMENT_UPLOADED,
      entityType: EntityType.DOCUMENT,
      entityId: caseIds.get('CASE-2026-00001')!,
      metadata: { fileName: 'vendor-dispute-evidence.pdf' },
    },
    {
      actorId: adminId,
      action: AuditAction.CREATED,
      entityType: EntityType.CASE,
      entityId: caseIds.get('CASE-2026-00002')!,
      metadata: { referenceCode: 'CASE-2026-00002' },
    },
    {
      actorId: managerId,
      action: AuditAction.UPDATED,
      entityType: EntityType.CONTRACT,
      entityId: contractIds.get('CTR-2026-00001')!,
      metadata: { fields: ['status'] },
    },
    {
      actorId: counselId,
      action: AuditAction.CREATED,
      entityType: EntityType.NOTICE,
      entityId: noticeIds.get('NTC-2026-00002')!,
      metadata: { referenceCode: 'NTC-2026-00002' },
    },
    {
      actorId: adminId,
      action: AuditAction.REASSIGNED,
      entityType: EntityType.CASE,
      entityId: caseIds.get('CASE-2026-00003')!,
      metadata: {
        fromUserId: counselId,
        toUserId: userIds.get('counsel2@legal.local')!,
      },
    },
    {
      actorId: managerId,
      action: AuditAction.DEADLINE_COMPLETED,
      entityType: EntityType.DEADLINE,
      entityId: caseIds.get('CASE-2026-00001')!,
      metadata: { title: 'Initial disclosure filing' },
    },
    {
      actorId: counselId,
      action: AuditAction.UPDATED,
      entityType: EntityType.CASE,
      entityId: caseIds.get('CASE-2026-00001')!,
      metadata: { fields: ['description'] },
    },
    {
      actorId: adminId,
      action: AuditAction.CREATED,
      entityType: EntityType.CONTRACT,
      entityId: contractIds.get('CTR-2026-00002')!,
      metadata: { referenceCode: 'CTR-2026-00002' },
    },
    {
      actorId: managerId,
      action: AuditAction.STATUS_CHANGED,
      entityType: EntityType.NOTICE,
      entityId: noticeIds.get('NTC-2026-00002')!,
      metadata: { from: 'RECEIVED', to: 'OVERDUE' },
    },
    {
      actorId: counselId,
      action: AuditAction.UPDATED,
      entityType: EntityType.NOTICE,
      entityId: noticeIds.get('NTC-2026-00001')!,
      metadata: { fields: ['description'] },
    },
  ];

  await prisma.activityLog.createMany({ data: logs });
}

async function seedDiscussions(
  userIds: Map<string, string>,
  caseIds: Map<string, string>,
  contractIds: Map<string, string>,
  noticeIds: Map<string, string>,
): Promise<void> {
  const counselId = userIds.get('counsel@legal.local')!;
  const managerId = userIds.get('manager@legal.local')!;

  const discussions = [
    {
      content: 'Initial review completed. Awaiting vendor response on delivery terms.',
      authorId: counselId,
      caseId: caseIds.get('CASE-2026-00001')!,
    },
    {
      content: 'Contract renewal should be prioritized before Q3.',
      authorId: managerId,
      contractId: contractIds.get('CTR-2026-00001')!,
    },
    {
      content: 'Regulatory notice requires legal sign-off by end of week.',
      authorId: counselId,
      noticeId: noticeIds.get('NTC-2026-00001')!,
    },
  ];

  for (const discussion of discussions) {
    const existing = await prisma.discussion.findFirst({
      where: {
        content: discussion.content,
        authorId: discussion.authorId,
      },
      select: { id: true },
    });

    if (!existing) {
      await prisma.discussion.create({ data: discussion });
    }
  }
}

async function seedFinancialRecords(
  userIds: Map<string, string>,
  caseIds: Map<string, string>,
  contractIds: Map<string, string>,
): Promise<void> {
  const managerId = userIds.get('manager@legal.local')!;
  const caseId = caseIds.get('CASE-2026-00001')!;
  const contractId = contractIds.get('CTR-2026-00001')!;

  const records = [
    {
      title: 'Litigation counsel fees',
      amount: new Prisma.Decimal('15000000.00'),
      currency: 'IRR',
      type: FinancialRecordType.EXPENSE,
      description: 'External counsel retainer for vendor dispute',
      recordDate: toUtcDateOnly(new Date('2026-02-15')),
      caseId,
      createdById: managerId,
    },
    {
      title: 'MSA annual license payment',
      amount: new Prisma.Decimal('8500000.00'),
      currency: 'IRR',
      type: FinancialRecordType.PAYMENT,
      description: 'Annual platform license under MSA',
      recordDate: toUtcDateOnly(new Date('2026-01-20')),
      contractId,
      createdById: managerId,
    },
  ];

  for (const record of records) {
    const existing = await prisma.financialRecord.findFirst({
      where: { title: record.title, createdById: record.createdById },
      select: { id: true },
    });

    if (!existing) {
      await prisma.financialRecord.create({ data: record });
    }
  }
}

async function seedReminders(userIds: Map<string, string>): Promise<void> {
  const adminId = userIds.get('admin@legal.local')!;
  const pendingDeadlines = await prisma.deadline.findMany({
    where: { status: DeadlineStatus.PENDING },
    select: { id: true, dueDate: true, title: true },
    take: 5,
  });

  for (const deadline of pendingDeadlines) {
    const existing = await prisma.reminder.findFirst({
      where: { deadlineId: deadline.id },
      select: { id: true },
    });

    if (existing) {
      continue;
    }

    const remindAt = new Date(deadline.dueDate);
    remindAt.setUTCDate(remindAt.getUTCDate() - 1);
    remindAt.setUTCHours(5, 30, 0, 0);

    await prisma.reminder.create({
      data: {
        deadlineId: deadline.id,
        remindAt,
        status: ReminderStatus.PENDING,
        message: `Reminder: ${deadline.title}`,
        createdById: adminId,
      },
    });
  }
}

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const userIds = await seedUsersData(passwordHash);

  const caseIds = new Map<string, string>();
  for (const seedCase of seedCases) {
    const ownerId = userIds.get(seedCase.ownerEmail);

    if (!ownerId) {
      throw new Error(`Owner not found for case ${seedCase.referenceCode}`);
    }

    const caseId = await upsertCaseWithParties(seedCase, ownerId);
    caseIds.set(seedCase.referenceCode, caseId);
  }

  const contractIds = await seedContracts(userIds);
  const noticeIds = await seedDeadlinesAndNotices(userIds, caseIds, contractIds);
  await seedTasks(userIds, caseIds, contractIds, noticeIds);
  await seedDocuments(userIds, caseIds, contractIds, noticeIds);
  await seedDiscussions(userIds, caseIds, contractIds, noticeIds);
  await seedFinancialRecords(userIds, caseIds, contractIds);
  await seedReminders(userIds);
  await seedActivityLogs(userIds, caseIds, contractIds, noticeIds);

  const partyCount = seedCases.reduce(
    (total, seedCase) => total + seedCase.parties.length,
    0,
  );

  console.log(`Seeded ${seedUsers.length} users (password: ${DEFAULT_PASSWORD})`);
  console.log(`Seeded ${seedCases.length} cases with ${partyCount} parties`);
  console.log(`Seeded ${contractIds.size} contracts`);
  console.log(`Seeded ${noticeIds.size} notices with linked deadlines`);
  console.log('Seeded standalone deadlines, tasks, documents, discussions, financial records, reminders, and activity logs');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
