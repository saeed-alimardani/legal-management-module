import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { DocumentType } from '../../domain/document-type.enum';

export class UploadDocumentDto {
  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Exactly one parent FK required' })
  @ValidateIf((dto: UploadDocumentDto) => !dto.contractId && !dto.noticeId)
  @IsUUID()
  caseId?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: UploadDocumentDto) => !dto.caseId && !dto.noticeId)
  @IsUUID()
  contractId?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: UploadDocumentDto) => !dto.caseId && !dto.contractId)
  @IsUUID()
  noticeId?: string;
}
