import { Prisma } from '@prisma/client';

function assignedTaskInvolvement(userId: string): Prisma.TaskWhereInput {
  return {
    deletedAt: null,
    assigneeId: userId,
  };
}

/** Owned or assigned matters (dashboard My Work + scoped list tabs). */
export function buildMyWorkCaseWhere(
  userId: string,
): Prisma.LegalCaseWhereInput {
  return {
    OR: [
      { ownerId: userId },
      { tasks: { some: assignedTaskInvolvement(userId) } },
      { deadlines: { some: { assigneeId: userId } } },
    ],
  };
}

export function buildMyWorkContractWhere(
  userId: string,
): Prisma.ContractWhereInput {
  return {
    OR: [
      { ownerId: userId },
      { tasks: { some: assignedTaskInvolvement(userId) } },
      { deadlines: { some: { assigneeId: userId } } },
    ],
  };
}

export function buildMyWorkNoticeWhere(
  userId: string,
): Prisma.LegalNoticeWhereInput {
  return {
    OR: [
      { ownerId: userId },
      { tasks: { some: assignedTaskInvolvement(userId) } },
      { deadlines: { some: { assigneeId: userId } } },
    ],
  };
}

export function buildMyWorkDeadlineWhere(
  userId: string,
): Prisma.DeadlineWhereInput {
  return {
    OR: [
      { assigneeId: userId },
      { legalCase: buildMyWorkCaseWhere(userId) },
      { contract: buildMyWorkContractWhere(userId) },
      { notice: buildMyWorkNoticeWhere(userId) },
    ],
  };
}

export function buildDashboardMyWorkDeadlineWhere(
  userId: string,
): Prisma.DeadlineWhereInput {
  return { assigneeId: userId };
}

export function buildCounselCaseWhere(
  userId: string,
): Prisma.LegalCaseWhereInput {
  return buildMyWorkCaseWhere(userId);
}

export function buildCounselContractWhere(
  userId: string,
): Prisma.ContractWhereInput {
  return buildMyWorkContractWhere(userId);
}

export function buildCounselNoticeWhere(
  userId: string,
): Prisma.LegalNoticeWhereInput {
  return buildMyWorkNoticeWhere(userId);
}

export function buildCounselDeadlineWhere(
  userId: string,
): Prisma.DeadlineWhereInput {
  return {
    OR: [
      { assigneeId: userId },
      { legalCase: buildCounselCaseWhere(userId) },
      { contract: buildCounselContractWhere(userId) },
      { notice: buildCounselNoticeWhere(userId) },
    ],
  };
}

export function buildCounselDocumentWhere(
  userId: string,
): Prisma.DocumentWhereInput {
  return {
    OR: [
      { uploadedById: userId },
      { legalCase: buildCounselCaseWhere(userId) },
      { contract: buildCounselContractWhere(userId) },
      { notice: buildCounselNoticeWhere(userId) },
    ],
  };
}

export function buildCounselDiscussionWhere(
  userId: string,
): Prisma.DiscussionWhereInput {
  return {
    OR: [
      { authorId: userId },
      { legalCase: buildCounselCaseWhere(userId) },
      { contract: buildCounselContractWhere(userId) },
      { notice: buildCounselNoticeWhere(userId) },
    ],
  };
}

export function buildCounselFinancialRecordWhere(
  userId: string,
): Prisma.FinancialRecordWhereInput {
  return {
    OR: [
      { createdById: userId },
      { legalCase: buildCounselCaseWhere(userId) },
      { contract: buildCounselContractWhere(userId) },
    ],
  };
}
