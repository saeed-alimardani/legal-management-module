import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

export class ListDocumentsQueryDto {
  @ApiPropertyOptional({ description: 'Exactly one parent FK required' })
  @ValidateIf((dto: ListDocumentsQueryDto) => !dto.contractId && !dto.noticeId)
  @IsUUID()
  caseId?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: ListDocumentsQueryDto) => !dto.caseId && !dto.noticeId)
  @IsUUID()
  contractId?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: ListDocumentsQueryDto) => !dto.caseId && !dto.contractId)
  @IsUUID()
  noticeId?: string;
}
