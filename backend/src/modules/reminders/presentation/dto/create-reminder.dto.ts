import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateReminderDto {
  @ApiProperty()
  @IsUUID()
  deadlineId!: string;

  @ApiProperty({ example: '2026-07-19T09:00:00.000Z' })
  @IsDateString()
  remindAt!: string;

  @ApiPropertyOptional({ example: 'Prepare filing documents' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message?: string;
}
