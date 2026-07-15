import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ReminderStatus } from '../../domain/reminder-status.enum';

export class UpdateReminderDto {
  @ApiPropertyOptional({ example: '2026-07-19T09:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  remindAt?: string;

  @ApiPropertyOptional({ example: 'Updated reminder message' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string | null;

  @ApiPropertyOptional({
    enum: [ReminderStatus.DISMISSED],
    description: 'Pass DISMISSED to dismiss a pending reminder',
  })
  @IsOptional()
  @IsEnum(ReminderStatus)
  status?: ReminderStatus;
}
