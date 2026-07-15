import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { FinancialRecordType } from '../../domain/financial-record-type.enum';

export class CreateFinancialRecordDto {
  @ApiProperty({ example: 'Court filing fee' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;

  @ApiProperty({ example: 1500000.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ example: 'IRR', default: 'IRR' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiProperty({ enum: FinancialRecordType })
  @IsEnum(FinancialRecordType)
  type!: FinancialRecordType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2026-07-14' })
  @IsDateString()
  recordDate!: string;

  @ApiPropertyOptional({ description: 'Exactly one parent FK required' })
  @ValidateIf((dto: CreateFinancialRecordDto) => !dto.contractId)
  @IsUUID()
  caseId?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: CreateFinancialRecordDto) => !dto.caseId)
  @IsUUID()
  contractId?: string;
}
