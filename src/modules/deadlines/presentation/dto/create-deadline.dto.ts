import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { DeadlineStatus } from '../../domain/deadline-status.enum';

export class CreateDeadlineDto {
  @ApiProperty({ example: 'File response brief' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;

  @ApiProperty({ example: '2026-07-20' })
  @IsDateString()
  dueDate!: string;

  @ApiPropertyOptional({
    enum: DeadlineStatus,
    default: DeadlineStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(DeadlineStatus)
  status?: DeadlineStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Exactly one parent FK required' })
  @ValidateIf(
    (dto: CreateDeadlineDto) =>
      !dto.contractId && !dto.noticeId,
  )
  @IsUUID()
  caseId?: string;

  @ApiPropertyOptional()
  @ValidateIf(
    (dto: CreateDeadlineDto) => !dto.caseId && !dto.noticeId,
  )
  @IsUUID()
  contractId?: string;

  @ApiPropertyOptional()
  @ValidateIf(
    (dto: CreateDeadlineDto) => !dto.caseId && !dto.contractId,
  )
  @IsUUID()
  noticeId?: string;
}
