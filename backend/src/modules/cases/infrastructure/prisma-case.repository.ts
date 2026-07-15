import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  buildCounselCaseWhere,
} from '../../../shared/access-control/counsel-involvement.where';
import {
  CreateCaseInput,
  CreateCasePartyInput,
  LegalCaseEntity,
  ListCasesFilters,
  UpdateCaseInput,
} from '../domain/case.types';
import {
  formatReferenceCode,
  getNextReferenceSequence,
  REFERENCE_CODE_PREFIX,
} from '../../../shared/utils/reference-code.util';

const caseIncludeParties = {
  parties: {
    orderBy: { name: 'asc' as const },
  },
} satisfies Prisma.LegalCaseInclude;

@Injectable()
export class PrismaCaseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async generateNextReferenceCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = REFERENCE_CODE_PREFIX.CASE;
    const pattern = `${prefix}-${year}-`;

    const latest = await this.prisma.legalCase.findFirst({
      where: {
        referenceCode: { startsWith: pattern },
      },
      orderBy: { referenceCode: 'desc' },
      select: { referenceCode: true },
    });

    const sequence = getNextReferenceSequence(
      latest?.referenceCode,
      prefix,
      year,
    );

    return formatReferenceCode(prefix, sequence, year);
  }

  async create(input: CreateCaseInput): Promise<LegalCaseEntity> {
    return this.prisma.legalCase.create({
      data: {
        referenceCode: input.referenceCode,
        title: input.title,
        type: input.type,
        status: input.status,
        priority: input.priority,
        ownerId: input.ownerId,
        description: input.description ?? null,
        openedDate: input.openedDate ?? null,
        closedDate: input.closedDate ?? null,
        parties: input.parties?.length
          ? {
              create: input.parties.map((party) => this.mapPartyCreate(party)),
            }
          : undefined,
      },
      include: caseIncludeParties,
    });
  }

  async findById(id: string): Promise<LegalCaseEntity | null> {
    return this.prisma.legalCase.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: caseIncludeParties,
    });
  }

  async findByIdIncludingDeleted(id: string): Promise<LegalCaseEntity | null> {
    return this.prisma.legalCase.findUnique({
      where: { id },
      include: caseIncludeParties,
    });
  }

  async isUserInvolved(caseId: string, userId: string): Promise<boolean> {
    const count = await this.prisma.legalCase.count({
      where: {
        id: caseId,
        deletedAt: null,
        ...buildCounselCaseWhere(userId),
      },
    });

    return count > 0;
  }

  async list(
    filters: ListCasesFilters,
    scope: Prisma.LegalCaseWhereInput,
  ): Promise<{ items: LegalCaseEntity[]; total: number }> {
    const where: Prisma.LegalCaseWhereInput = {
      deletedAt: null,
      ...scope,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
    };

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      this.prisma.legalCase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit,
        include: caseIncludeParties,
      }),
      this.prisma.legalCase.count({ where }),
    ]);

    return { items, total };
  }

  async update(id: string, input: UpdateCaseInput): Promise<LegalCaseEntity> {
    return this.prisma.legalCase.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.openedDate !== undefined
          ? { openedDate: input.openedDate }
          : {}),
        ...(input.closedDate !== undefined
          ? { closedDate: input.closedDate }
          : {}),
      },
      include: caseIncludeParties,
    });
  }

  async softDelete(id: string): Promise<LegalCaseEntity> {
    return this.prisma.legalCase.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: caseIncludeParties,
    });
  }

  async reassign(id: string, ownerId: string): Promise<LegalCaseEntity> {
    return this.prisma.legalCase.update({
      where: { id },
      data: { ownerId },
      include: caseIncludeParties,
    });
  }

  async listParties(caseId: string) {
    return this.prisma.caseParty.findMany({
      where: { caseId },
      orderBy: { name: 'asc' },
    });
  }

  async addParty(caseId: string, input: CreateCasePartyInput) {
    return this.prisma.caseParty.create({
      data: {
        caseId,
        name: input.name,
        partyType: input.partyType,
        contactInfo: input.contactInfo ?? null,
        notes: input.notes ?? null,
      },
    });
  }

  async findPartyById(caseId: string, partyId: string) {
    return this.prisma.caseParty.findFirst({
      where: { id: partyId, caseId },
    });
  }

  async updateParty(
    caseId: string,
    partyId: string,
    input: {
      name?: string;
      partyType?: CreateCasePartyInput['partyType'];
      contactInfo?: string | null;
      notes?: string | null;
    },
  ) {
    return this.prisma.caseParty.update({
      where: { id: partyId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.partyType !== undefined ? { partyType: input.partyType } : {}),
        ...(input.contactInfo !== undefined
          ? { contactInfo: input.contactInfo }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
  }

  async deleteParty(caseId: string, partyId: string) {
    return this.prisma.caseParty.delete({
      where: { id: partyId },
    });
  }

  async userExistsAndActive(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        isActive: true,
      },
      select: { id: true },
    });

    return user !== null;
  }

  private mapPartyCreate(party: CreateCasePartyInput) {
    return {
      name: party.name,
      partyType: party.partyType,
      contactInfo: party.contactInfo ?? null,
      notes: party.notes ?? null,
    };
  }
}
