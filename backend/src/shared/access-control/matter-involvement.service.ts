import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildCounselCaseWhere,
  buildCounselContractWhere,
  buildCounselNoticeWhere,
} from './counsel-involvement.where';

export interface MatterParentRef {
  caseId?: string | null;
  contractId?: string | null;
  noticeId?: string | null;
}

@Injectable()
export class MatterInvolvementService {
  constructor(private readonly prisma: PrismaService) {}

  async isUserInvolvedInParent(
    parent: MatterParentRef,
    userId: string,
  ): Promise<boolean> {
    if (parent.caseId) {
      const count = await this.prisma.legalCase.count({
        where: {
          id: parent.caseId,
          deletedAt: null,
          ...buildCounselCaseWhere(userId),
        },
      });
      return count > 0;
    }

    if (parent.contractId) {
      const count = await this.prisma.contract.count({
        where: {
          id: parent.contractId,
          deletedAt: null,
          ...buildCounselContractWhere(userId),
        },
      });
      return count > 0;
    }

    if (parent.noticeId) {
      const count = await this.prisma.legalNotice.count({
        where: {
          id: parent.noticeId,
          deletedAt: null,
          ...buildCounselNoticeWhere(userId),
        },
      });
      return count > 0;
    }

    return false;
  }
}
