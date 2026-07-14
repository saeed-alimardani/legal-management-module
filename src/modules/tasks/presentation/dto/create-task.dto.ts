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
import { TaskStatus } from '../../domain/task-status.enum';

export class CreateTaskDto {
  @ApiProperty({ example: 'Draft response letter' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.TODO })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty()
  @IsUUID()
  assigneeId!: string;

  @ApiPropertyOptional({ example: '2026-07-20' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Exactly one parent FK required' })
  @ValidateIf((dto: CreateTaskDto) => !dto.contractId && !dto.noticeId)
  @IsUUID()
  caseId?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: CreateTaskDto) => !dto.caseId && !dto.noticeId)
  @IsUUID()
  contractId?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: CreateTaskDto) => !dto.caseId && !dto.contractId)
  @IsUUID()
  noticeId?: string;
}
