import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, ValidateIf } from 'class-validator';

export class CreateDiscussionDto {
  @ApiProperty({ example: 'Please review the attached clause.' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({ description: 'Exactly one parent FK required' })
  @ValidateIf((dto: CreateDiscussionDto) => !dto.contractId && !dto.noticeId)
  @IsUUID()
  caseId?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: CreateDiscussionDto) => !dto.caseId && !dto.noticeId)
  @IsUUID()
  contractId?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: CreateDiscussionDto) => !dto.caseId && !dto.contractId)
  @IsUUID()
  noticeId?: string;
}
