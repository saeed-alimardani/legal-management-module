import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { DeadlineStatus } from '../../domain/deadline-status.enum';

export class UpdateDeadlineDto {
  @ApiPropertyOptional({ example: 'Updated deadline title' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional({ example: '2026-07-25' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ enum: DeadlineStatus })
  @IsOptional()
  @IsEnum(DeadlineStatus)
  status?: DeadlineStatus;

  @ApiPropertyOptional({
    description: 'Pass null to clear assignee',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;
}
