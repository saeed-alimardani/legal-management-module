import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaDocumentRepository } from '../infrastructure/prisma-document.repository';
import {
  getDocumentResponseTimeZone,
  resolveParentOwnerId,
  toDocumentResponse,
} from './document.helpers';

@Injectable()
export class GetDocumentUseCase {
  constructor(
    private readonly documentRepository: PrismaDocumentRepository,
    private readonly accessControl: AccessControlService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, documentId: string) {
    const document = await this.documentRepository.findById(documentId);

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const parentOwnerId = resolveParentOwnerId(document);

    if (!parentOwnerId) {
      throw new NotFoundException('Document not found');
    }

    this.accessControl.assertCanView(user, { ownerId: parentOwnerId });

    const timeZone = getDocumentResponseTimeZone(this.configService);
    return buildSingleResponse(toDocumentResponse(document, timeZone));
  }
}
