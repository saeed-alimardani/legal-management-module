import { Module } from '@nestjs/common';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { DeleteDocumentUseCase } from './application/delete-document.use-case';
import { DownloadDocumentUseCase } from './application/download-document.use-case';
import { GetDocumentUseCase } from './application/get-document.use-case';
import { ListDocumentsUseCase } from './application/list-documents.use-case';
import { UploadDocumentUseCase } from './application/upload-document.use-case';
import { FileStoragePort } from './domain/file-storage.port';
import { LocalFileStorageAdapter } from './infrastructure/local-file-storage.adapter';
import { PrismaDocumentRepository } from './infrastructure/prisma-document.repository';
import { DocumentsController } from './presentation/documents.controller';

@Module({
  controllers: [DocumentsController],
  providers: [
    RolesGuard,
    PrismaDocumentRepository,
    LocalFileStorageAdapter,
    {
      provide: FileStoragePort,
      useExisting: LocalFileStorageAdapter,
    },
    UploadDocumentUseCase,
    ListDocumentsUseCase,
    GetDocumentUseCase,
    DownloadDocumentUseCase,
    DeleteDocumentUseCase,
  ],
})
export class DocumentsModule {}
