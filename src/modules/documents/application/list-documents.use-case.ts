import { BadRequestException, Injectable } from '@nestjs/common';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaDocumentRepository } from '../infrastructure/prisma-document.repository';
import { countParentRefs, toDocumentResponse } from './document.helpers';

export interface ListDocumentsCommand {
  caseId?: string;
  contractId?: string;
  noticeId?: string;
}

@Injectable()
export class ListDocumentsUseCase {
  constructor(
    private readonly documentRepository: PrismaDocumentRepository,
    private readonly accessControl: AccessControlService,
  ) {}

  async execute(user: AuthenticatedUser, command: ListDocumentsCommand) {
    if (countParentRefs(command) !== 1) {
      throw new BadRequestException(
        'Exactly one of caseId, contractId, or noticeId is required',
      );
    }

    const scope = this.accessControl.buildDocumentListFilter(user);
    const items = await this.documentRepository.list(
      {
        caseId: command.caseId,
        contractId: command.contractId,
        noticeId: command.noticeId,
      },
      scope,
    );

    return buildSingleResponse(items.map(toDocumentResponse));
  }
}
