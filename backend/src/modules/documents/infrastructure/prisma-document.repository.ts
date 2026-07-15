import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateDocumentInput,
  DocumentListScope,
  DocumentWithParent,
  ListDocumentsFilters,
  ParentRef,
} from '../domain/document.types';

const parentInclude = {
  legalCase: { select: { ownerId: true, deletedAt: true } },
  contract: { select: { ownerId: true, deletedAt: true } },
  notice: { select: { ownerId: true, deletedAt: true } },
} satisfies Prisma.DocumentInclude;

@Injectable()
export class PrismaDocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateDocumentInput): Promise<DocumentWithParent> {
    return this.prisma.document.create({
      data: {
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        storageKey: input.storageKey,
        documentType: input.documentType,
        description: input.description ?? null,
        uploadedById: input.uploadedById,
        caseId: input.caseId || null,
        contractId: input.contractId || null,
        noticeId: input.noticeId || null,
      },
      include: parentInclude,
    });
  }

  async findById(id: string): Promise<DocumentWithParent | null> {
    return this.prisma.document.findFirst({
      where: { id, deletedAt: null },
      include: parentInclude,
    });
  }

  async list(
    filters: ListDocumentsFilters,
    scope: DocumentListScope,
  ): Promise<DocumentWithParent[]> {
    const where: Prisma.DocumentWhereInput = {
      deletedAt: null,
      ...this.buildScopeWhere(scope),
      ...(filters.caseId ? { caseId: filters.caseId } : {}),
      ...(filters.contractId ? { contractId: filters.contractId } : {}),
      ...(filters.noticeId ? { noticeId: filters.noticeId } : {}),
    };

    return this.prisma.document.findMany({
      where,
      orderBy: { uploadedAt: 'desc' },
      include: parentInclude,
    });
  }

  async softDelete(id: string): Promise<DocumentWithParent> {
    return this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: parentInclude,
    });
  }

  async findParentOwner(
    parent: ParentRef,
  ): Promise<{ ownerId: string } | null> {
    if (parent.caseId) {
      return this.prisma.legalCase.findFirst({
        where: { id: parent.caseId, deletedAt: null },
        select: { ownerId: true },
      });
    }

    if (parent.contractId) {
      return this.prisma.contract.findFirst({
        where: { id: parent.contractId, deletedAt: null },
        select: { ownerId: true },
      });
    }

    if (parent.noticeId) {
      return this.prisma.legalNotice.findFirst({
        where: { id: parent.noticeId, deletedAt: null },
        select: { ownerId: true },
      });
    }

    return null;
  }

  private buildScopeWhere(scope: DocumentListScope): Prisma.DocumentWhereInput {
    if (!scope.counselUserId) {
      return {};
    }

    const userId = scope.counselUserId;

    return {
      OR: [
        { uploadedById: userId },
        { legalCase: { ownerId: userId, deletedAt: null } },
        { contract: { ownerId: userId, deletedAt: null } },
        { notice: { ownerId: userId, deletedAt: null } },
      ],
    };
  }
}
