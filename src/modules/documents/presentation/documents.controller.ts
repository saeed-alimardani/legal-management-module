import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { APP_CONSTANTS } from '../../../config/constants';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { DeleteDocumentUseCase } from '../application/delete-document.use-case';
import { DownloadDocumentUseCase } from '../application/download-document.use-case';
import { GetDocumentUseCase } from '../application/get-document.use-case';
import { ListDocumentsUseCase } from '../application/list-documents.use-case';
import { UploadDocumentUseCase } from '../application/upload-document.use-case';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

interface UploadedFilePayload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly uploadDocumentUseCase: UploadDocumentUseCase,
    private readonly listDocumentsUseCase: ListDocumentsUseCase,
    private readonly getDocumentUseCase: GetDocumentUseCase,
    private readonly downloadDocumentUseCase: DownloadDocumentUseCase,
    private readonly deleteDocumentUseCase: DeleteDocumentUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List documents by parent matter' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListDocumentsQueryDto,
  ) {
    return this.listDocumentsUseCase.execute(user, {
      caseId: query.caseId,
      contractId: query.contractId,
      noticeId: query.noticeId,
    });
  }

  @Post()
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER, UserRole.LEGAL_COUNSEL)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: APP_CONSTANTS.MAX_UPLOAD_SIZE_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'documentType'],
      properties: {
        file: { type: 'string', format: 'binary' },
        documentType: {
          type: 'string',
          enum: ['CONTRACT', 'EVIDENCE', 'CORRESPONDENCE', 'FILING', 'OTHER'],
        },
        description: { type: 'string' },
        caseId: { type: 'string', format: 'uuid' },
        contractId: { type: 'string', format: 'uuid' },
        noticeId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload a document (multipart)' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedFilePayload | undefined,
    @Body() dto: UploadDocumentDto,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    return this.uploadDocumentUseCase.execute(user, {
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      buffer: file.buffer,
      documentType: dto.documentType,
      description: dto.description,
      caseId: dto.caseId,
      contractId: dto.contractId,
      noticeId: dto.noticeId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document metadata' })
  @ApiNotFoundResponse({ description: 'Document not found' })
  @ApiForbiddenResponse({ description: 'Access denied' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getDocumentUseCase.execute(user, id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download document binary' })
  @ApiNotFoundResponse({ description: 'Document not found' })
  @ApiForbiddenResponse({ description: 'Access denied' })
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const result = await this.downloadDocumentUseCase.execute(user, id);

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(result.fileName)}"`,
    );
    res.send(result.buffer);
  }

  @Delete(':id')
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER, UserRole.LEGAL_COUNSEL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete document metadata' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deleteDocumentUseCase.execute(user, id);
  }
}
