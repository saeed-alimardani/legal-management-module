import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CaseStatus } from '../../domain/case-status.enum';
import { CaseType } from '../../domain/case-type.enum';
import { Priority } from '@prisma/client';
import { CreatePartyDto } from './create-party.dto';

export class CreateCaseDto {
  @ApiProperty({ example: 'Dispute with Vendor X' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;

  @ApiProperty({ enum: CaseType, example: CaseType.LITIGATION })
  @IsEnum(CaseType)
  type!: CaseType;

  @ApiPropertyOptional({ enum: CaseStatus, default: CaseStatus.OPEN })
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @ApiProperty({ enum: Priority, example: Priority.HIGH })
  @IsEnum(Priority)
  priority!: Priority;

  @ApiPropertyOptional({
    description: 'Only admins and managers may assign a different owner',
  })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  openedDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  closedDate?: string;

  @ApiPropertyOptional({ type: [CreatePartyDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePartyDto)
  parties?: CreatePartyDto[];
}
